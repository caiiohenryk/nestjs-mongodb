import { ObjectId } from 'mongodb';
import request from 'supertest';
import { up as backfillOrdersV2 } from '../migrations/20261120214303-backfill-orders-v2.js';
import { up as createOrdersV2 } from '../migrations/20261120214301-create-orders-v2-collection.js';
import { type ConnectedDb, connectDb } from './support/mongo-client.js';
import { type MongoMemory, startMongoMemory } from './support/mongo-memory.js';
import { createTestApp, type TestApp } from './support/test-app.js';

function legacyOrder(createdAt: string, status: string, totalCents: number): Record<string, unknown> {
  const date = new Date(createdAt);
  return {
    _id: new ObjectId(),
    customerName: 'Ana',
    customerEmail: 'ana@example.com',
    items: [{ sku: 'A1', name: 'Mouse', quantity: 1, unitPriceCents: totalCents }],
    totalCents,
    status,
    schemaVersion: 1,
    createdAt: date,
    updatedAt: date,
  };
}

const expectedAllStatuses = {
  from: '2026-03-01T00:00:00.000Z',
  to: '2026-03-04T00:00:00.000Z',
  days: [
    { day: '2026-03-01', orderCount: 2, grossCents: 3000 },
    { day: '2026-03-03', orderCount: 1, grossCents: 500 },
  ],
};

describe('Orders daily revenue report (e2e)', () => {
  let mongo: MongoMemory;
  let connection: ConnectedDb;
  let v1App: TestApp;
  let v2App: TestApp;

  beforeAll(async () => {
    mongo = await startMongoMemory('orders_daily_revenue_e2e');
    connection = await connectDb(mongo.uri);
    await connection.db
      .collection('orders')
      .insertMany([
        legacyOrder('2026-03-01T00:00:00.000Z', 'PAID', 1000),
        legacyOrder('2026-03-01T23:59:59.999Z', 'CANCELED', 2000),
        legacyOrder('2026-03-03T12:00:00.000Z', 'PAID', 500),
        legacyOrder('2026-03-04T00:00:00.000Z', 'PAID', 9999),
        legacyOrder('2026-02-28T23:59:59.999Z', 'PAID', 9999),
      ]);
    await createOrdersV2(connection.db);
    await backfillOrdersV2(connection.db);
    v1App = await createTestApp(mongo.uri);
    v2App = await createTestApp(mongo.uri, { ORDERS_DUAL_WRITE: 'true', ORDERS_READ_FROM_V2: 'true' });
  });

  afterAll(async () => {
    await v1App.close();
    await v2App.close();
    await connection.close();
    await mongo.stop();
  });

  it('groups revenue per utc day inside a half open range', async () => {
    const response = await request(v1App.getHttpServer())
      .get('/orders/reports/daily-revenue')
      .query({ from: '2026-03-01T00:00:00Z', to: '2026-03-04T00:00:00Z' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expectedAllStatuses);
  });

  it('filters by status', async () => {
    const response = await request(v1App.getHttpServer())
      .get('/orders/reports/daily-revenue')
      .query({ from: '2026-03-01T00:00:00Z', to: '2026-03-04T00:00:00Z', status: 'PAID' });

    expect(response.body).toMatchObject({
      days: [
        { day: '2026-03-01', orderCount: 1, grossCents: 1000 },
        { day: '2026-03-03', orderCount: 1, grossCents: 500 },
      ],
    });
  });

  it('returns the same report when reading from orders_v2', async () => {
    const response = await request(v2App.getHttpServer())
      .get('/orders/reports/daily-revenue')
      .query({ from: '2026-03-01T00:00:00Z', to: '2026-03-04T00:00:00Z' });

    expect(response.body).toEqual(expectedAllStatuses);
  });

  it('rejects inverted, oversized and malformed ranges', async () => {
    const server = v1App.getHttpServer();
    const report = '/orders/reports/daily-revenue';

    await request(server).get(report).query({ from: '2026-03-04T00:00:00Z', to: '2026-03-01T00:00:00Z' }).expect(400);
    await request(server).get(report).query({ from: '2025-01-01T00:00:00Z', to: '2026-03-01T00:00:00Z' }).expect(400);
    await request(server).get(report).query({ from: 'yesterday', to: '2026-03-01T00:00:00Z' }).expect(400);
  });
});
