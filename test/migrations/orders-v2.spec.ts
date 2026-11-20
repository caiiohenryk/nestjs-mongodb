import { type Document, MongoServerError, ObjectId } from 'mongodb';
import { down as backfillDown, up as backfillUp } from '../../migrations/20261120214303-backfill-orders-v2.js';
import {
  down as createCollectionDown,
  up as createCollectionUp,
} from '../../migrations/20261120214301-create-orders-v2-collection.js';
import { backfillOrdersV2 } from '../../scripts/support/orders-v2-backfill.ts';
import { type ConnectedDb, connectDb } from '../support/mongo-client.js';
import { type MongoMemory, startMongoMemory } from '../support/mongo-memory.js';

const createdAt = new Date('2026-01-10T12:00:00.000Z');

const legacyOrders: Document[] = [
  {
    _id: new ObjectId(),
    customerName: 'Ana',
    customerEmail: 'ana@example.com',
    items: [
      { sku: 'A1', name: 'Mouse', quantity: 2, unitPriceCents: 5000 },
      { sku: 'B7', name: 'Pad', quantity: 1, unitPriceCents: 3000 },
    ],
    totalCents: 13000,
    status: 'PAID',
    schemaVersion: 1,
    createdAt,
    updatedAt: createdAt,
  },
  {
    _id: new ObjectId(),
    customerName: 'Bia',
    customerEmail: 'bia@example.com',
    totalCents: 0,
    status: 'canceled',
    schemaVersion: 1,
    createdAt,
    updatedAt: createdAt,
  },
  {
    _id: new ObjectId(),
    customerName: 'Caio',
    customerEmail: 'caio@example.com',
    items: [],
    totalCents: 0,
    status: 'PENDING',
    schemaVersion: 1,
    createdAt,
    updatedAt: createdAt,
  },
];

function withoutSyncedAt(documents: Document[]): Document[] {
  return documents.map(({ syncedAt: _syncedAt, ...rest }) => rest);
}

describe('migrations orders -> orders_v2', () => {
  let mongo: MongoMemory;
  let connection: ConnectedDb;

  beforeAll(async () => {
    mongo = await startMongoMemory('migration_orders_v2');
    connection = await connectDb(mongo.uri);
  });

  afterAll(async () => {
    await connection.close();
    await mongo.stop();
  });

  beforeEach(async () => {
    await createCollectionDown(connection.db);
    await connection.db.collection('orders').deleteMany({});
    await connection.db.collection('migration_checkpoints').deleteMany({});
    await connection.db.collection('orders').insertMany(legacyOrders.map((order) => ({ ...order })));
    await createCollectionUp(connection.db);
  });

  function readV2(): Promise<Document[]> {
    return connection.db.collection('orders_v2').find().sort({ _id: 1 }).toArray();
  }

  it('reshapes every legacy order into the v2 format', async () => {
    await backfillUp(connection.db);

    const ana = await connection.db.collection('orders_v2').findOne({ 'customer.name': 'Ana' });
    expect(ana).toMatchObject({
      customer: { name: 'Ana', email: 'ana@example.com' },
      items: [
        { sku: 'A1', quantity: 2, unitPriceCents: 5000, subtotalCents: 10000 },
        { sku: 'B7', quantity: 1, unitPriceCents: 3000, subtotalCents: 3000 },
      ],
      totals: { grossCents: 13000, itemCount: 3 },
      status: 'paid',
      schemaVersion: 2,
      createdAt,
    });
    expect(ana).not.toHaveProperty('customerName');
    expect(await connection.db.collection('orders_v2').countDocuments()).toBe(3);
  });

  it('handles orders without items', async () => {
    await backfillUp(connection.db);

    const bia = await connection.db.collection('orders_v2').findOne({ 'customer.name': 'Bia' });
    expect(bia).toMatchObject({ items: [], totals: { grossCents: 0, itemCount: 0 }, status: 'canceled' });
  });

  it('is idempotent', async () => {
    await backfillUp(connection.db);
    const first = await readV2();

    await backfillUp(connection.db);

    expect(await readV2()).toEqual(first);
  });

  it('keeps v2 documents that are newer than the source', async () => {
    await backfillUp(connection.db);
    const newer = new Date('2026-06-01T00:00:00.000Z');
    await connection.db
      .collection('orders_v2')
      .updateOne({ 'customer.name': 'Ana' }, { $set: { status: 'canceled', updatedAt: newer } });

    await backfillUp(connection.db);

    const ana = await connection.db.collection('orders_v2').findOne({ 'customer.name': 'Ana' });
    expect(ana).toMatchObject({ status: 'canceled', updatedAt: newer });
  });

  it('produces the same documents with the batch script as with $merge', async () => {
    await backfillUp(connection.db);
    const fromMerge = withoutSyncedAt(await readV2());
    await backfillDown(connection.db);

    const progress = await backfillOrdersV2(connection.db, { batchSize: 2 });

    expect(progress).toMatchObject({ processed: 3, written: 3, skippedNewer: 0 });
    expect(withoutSyncedAt(await readV2())).toEqual(fromMerge);
  });

  it('skips newer v2 documents in the batch script and clears its checkpoint', async () => {
    await backfillOrdersV2(connection.db, { batchSize: 2 });
    await connection.db
      .collection('orders_v2')
      .updateOne({ 'customer.name': 'Caio' }, { $set: { updatedAt: new Date('2027-01-01T00:00:00.000Z') } });

    const progress = await backfillOrdersV2(connection.db, { batchSize: 2 });

    expect(progress.skippedNewer).toBe(3);
    expect(await connection.db.collection('migration_checkpoints').countDocuments()).toBe(0);
  });

  it('rejects documents that break the collection validator', async () => {
    await expect(
      connection.db.collection('orders_v2').insertOne({ customer: { name: 'X' }, status: 'PAID' }),
    ).rejects.toThrow(MongoServerError);
  });

  it('empties orders_v2 on backfill down', async () => {
    await backfillUp(connection.db);

    await backfillDown(connection.db);

    expect(await connection.db.collection('orders_v2').countDocuments()).toBe(0);
  });
});
