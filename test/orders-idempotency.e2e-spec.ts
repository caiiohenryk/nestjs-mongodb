import request from 'supertest';
import { z } from 'zod';
import { up as createIdempotencyKeys } from '../migrations/20261120223143-create-order-idempotency-keys.js';
import { type ConnectedDb, connectDb } from './support/mongo-client.js';
import { type MongoMemory, startMongoMemory } from './support/mongo-memory.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const orderBodySchema = z.object({ id: z.string() }).loose();

const validOrder = {
  customerName: 'Ana',
  customerEmail: 'ana@example.com',
  items: [{ sku: 'A1', name: 'Mouse', quantity: 2, unitPriceCents: 5000 }],
};

describe('Orders idempotency (e2e)', () => {
  let mongo: MongoMemory;
  let connection: ConnectedDb;
  let app: TestApp;

  beforeAll(async () => {
    mongo = await startMongoMemory('orders_idempotency_e2e');
    connection = await connectDb(mongo.uri);
    await createIdempotencyKeys(connection.db);
    app = await createTestApp(mongo.uri);
  });

  afterAll(async () => {
    await app.close();
    await connection.close();
    await mongo.stop();
  });

  function post(key: string | undefined, body: object = validOrder): request.Test {
    const call = request(app.getHttpServer()).post('/orders').send(body);
    return key === undefined ? call : call.set('Idempotency-Key', key);
  }

  function countOrders(customerName: string): Promise<number> {
    return connection.db.collection('orders').countDocuments({ customerName });
  }

  it('returns the original order when the same key is retried', async () => {
    const body = { ...validOrder, customerName: 'Retry' };

    const first = await post('retry-key-0001', body).expect(201);
    const second = await post('retry-key-0001', body).expect(201);

    expect(orderBodySchema.parse(second.body).id).toBe(orderBodySchema.parse(first.body).id);
    expect(await countOrders('Retry')).toBe(1);
  });

  it('rejects reusing a key with a different request', async () => {
    await post('reuse-key-0001', { ...validOrder, customerName: 'Reuse' }).expect(201);

    const response = await post('reuse-key-0001', { ...validOrder, customerName: 'Someone else' });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ message: 'Idempotency-Key was already used with a different request' });
  });

  it('creates a single order for concurrent requests with the same key', async () => {
    const body = { ...validOrder, customerName: 'Concurrent' };

    const responses = await Promise.all(Array.from({ length: 5 }, () => post('concurrent-key-0001', body)));

    const ids = new Set(responses.map((response) => orderBodySchema.parse(response.body).id));
    expect(responses.map((response) => response.status)).toEqual([201, 201, 201, 201, 201]);
    expect(ids.size).toBe(1);
    expect(await countOrders('Concurrent')).toBe(1);
  });

  it('keeps creating new orders when no key is sent', async () => {
    const body = { ...validOrder, customerName: 'NoKey' };

    await post(undefined, body).expect(201);
    await post(undefined, body).expect(201);

    expect(await countOrders('NoKey')).toBe(2);
  });

  it('rejects malformed keys', async () => {
    await post('short').expect(400);
    await post('has spaces in it').expect(400);
  });
});
