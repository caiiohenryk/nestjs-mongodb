import request from 'supertest';
import { up as createOrdersV2 } from '../migrations/20261120214301-create-orders-v2-collection.js';
import { type ConnectedDb, connectDb } from './support/mongo-client.js';
import { type MongoMemory, startMongoMemory } from './support/mongo-memory.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const WRITE_CONFLICT = 112;
const BAD_VALUE = 2;

const validOrder = {
  customerName: 'Ana',
  customerEmail: 'ana@example.com',
  items: [{ sku: 'A1', name: 'Mouse', quantity: 2, unitPriceCents: 5000 }],
};

type FailPoint = {
  readonly command: 'insert' | 'update';
  readonly errorCode: number;
  readonly errorLabels: readonly string[];
};

describe('Orders transaction retry (e2e)', () => {
  let mongo: MongoMemory;
  let connection: ConnectedDb;
  let app: TestApp;

  beforeAll(async () => {
    mongo = await startMongoMemory('orders_transaction_retry_e2e', { testCommands: true });
    connection = await connectDb(mongo.uri);
    await createOrdersV2(connection.db);
    app = await createTestApp(mongo.uri, { ORDERS_DUAL_WRITE: 'true' });
  });

  afterAll(async () => {
    await app.close();
    await connection.close();
    await mongo.stop();
  });

  beforeEach(async () => {
    await connection.db.collection('orders').deleteMany({});
    await connection.db.collection('orders_v2').deleteMany({});
  });

  afterEach(async () => {
    await connection.db.admin().command({ configureFailPoint: 'failCommand', mode: 'off' });
  });

  async function failOnce(failPoint: FailPoint): Promise<void> {
    await connection.db.admin().command({
      configureFailPoint: 'failCommand',
      mode: { times: 1 },
      data: {
        failCommands: [failPoint.command],
        errorCode: failPoint.errorCode,
        errorLabels: failPoint.errorLabels,
      },
    });
  }

  async function counts(): Promise<{ v1: number; v2: number }> {
    return {
      v1: await connection.db.collection('orders').countDocuments(),
      v2: await connection.db.collection('orders_v2').countDocuments(),
    };
  }

  it('retries the whole transaction on a transient error and writes each order once', async () => {
    await failOnce({ command: 'insert', errorCode: WRITE_CONFLICT, errorLabels: ['TransientTransactionError'] });

    const response = await request(app.getHttpServer()).post('/orders').send(validOrder);

    expect(response.status).toBe(201);
    expect(await counts()).toEqual({ v1: 1, v2: 1 });
  });

  it('rolls back both collections on a non transient failure of the v2 write', async () => {
    await failOnce({ command: 'update', errorCode: BAD_VALUE, errorLabels: [] });

    const response = await request(app.getHttpServer()).post('/orders').send(validOrder);

    expect(response.status).toBe(500);
    expect(await counts()).toEqual({ v1: 0, v2: 0 });
  });
});
