import { type Document, MongoServerError, ObjectId } from 'mongodb';
import { up as createOrdersV2 } from '../../migrations/20261120214301-create-orders-v2-collection.js';
import { down, up } from '../../migrations/20261120222354-tighten-orders-v2-validator.js';
import { type ConnectedDb, connectDb } from '../support/mongo-client.js';
import { type MongoMemory, startMongoMemory } from '../support/mongo-memory.js';

const DOCUMENT_FAILED_VALIDATION = 121;

function buildOrderV2(overrides: Document = {}): Document {
  const now = new Date();
  return {
    _id: new ObjectId(),
    customer: { name: 'Ana', email: 'ana@example.com' },
    items: [{ sku: 'A1', name: 'Mouse', quantity: 2, unitPriceCents: 5000, subtotalCents: 10000 }],
    totals: { grossCents: 10000, itemCount: 2 },
    status: 'pending',
    schemaVersion: 2,
    createdAt: now,
    updatedAt: now,
    syncedAt: now,
    ...overrides,
  };
}

function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (rejection: unknown) => rejection,
  );
}

describe('migration tighten-orders-v2-validator', () => {
  let mongo: MongoMemory;
  let connection: ConnectedDb;

  beforeAll(async () => {
    mongo = await startMongoMemory('migration_tighten_orders_v2');
    connection = await connectDb(mongo.uri);
  });

  afterAll(async () => {
    await connection.close();
    await mongo.stop();
  });

  beforeEach(async () => {
    await connection.db.dropCollection('orders_v2').catch(() => false);
    await createOrdersV2(connection.db);
  });

  it('is idempotent and keeps accepting valid documents', async () => {
    await up(connection.db);
    await up(connection.db);

    await expect(connection.db.collection('orders_v2').insertOne(buildOrderV2())).resolves.toBeDefined();
  });

  it('rejects fractional quantities and missing syncedAt', async () => {
    await up(connection.db);
    const orders = connection.db.collection('orders_v2');

    const fractional = await rejectionOf(
      orders.insertOne(
        buildOrderV2({
          items: [{ sku: 'A1', name: 'Mouse', quantity: 1.5, unitPriceCents: 5000, subtotalCents: 7500 }],
        }),
      ),
    );
    const { syncedAt: _syncedAt, ...withoutSyncedAt } = buildOrderV2();
    const missingSyncedAt = await rejectionOf(orders.insertOne(withoutSyncedAt));

    expect(fractional).toBeInstanceOf(MongoServerError);
    expect(fractional).toMatchObject({ code: DOCUMENT_FAILED_VALIDATION });
    expect(missingSyncedAt).toMatchObject({ code: DOCUMENT_FAILED_VALIDATION });
  });

  it('refuses to tighten while existing documents would violate it', async () => {
    const { syncedAt: _syncedAt, ...legacy } = buildOrderV2();
    await connection.db.collection('orders_v2').insertOne(legacy);

    await expect(up(connection.db)).rejects.toThrow(/violate the new validator/);
  });

  it('restores the previous validator on down', async () => {
    await up(connection.db);

    await down(connection.db);

    const { syncedAt: _syncedAt, ...withoutSyncedAt } = buildOrderV2();
    await expect(connection.db.collection('orders_v2').insertOne(withoutSyncedAt)).resolves.toBeDefined();
  });
});
