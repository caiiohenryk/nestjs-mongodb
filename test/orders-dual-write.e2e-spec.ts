import { ObjectId } from 'mongodb';
import request from 'supertest';
import { z } from 'zod';
import { up as createOrdersV2 } from '../migrations/20261120214301-create-orders-v2-collection.js';
import { type ConnectedDb, connectDb } from './support/mongo-client.js';
import { type MongoMemory, startMongoMemory } from './support/mongo-memory.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const orderBodySchema = z.object({ id: z.string() }).loose();

const pageSchema = z.object({ data: z.array(orderBodySchema) });

const validOrder = {
  customerName: 'Ana',
  customerEmail: 'ana@example.com',
  items: [
    { sku: 'A1', name: 'Mouse', quantity: 2, unitPriceCents: 5000 },
    { sku: 'B7', name: 'Pad', quantity: 1, unitPriceCents: 3000 },
  ],
};

describe('Orders dual write and read switch (e2e)', () => {
  let mongo: MongoMemory;
  let connection: ConnectedDb;
  let writer: TestApp;

  beforeAll(async () => {
    mongo = await startMongoMemory('orders_dual_write_e2e');
    connection = await connectDb(mongo.uri);
    await createOrdersV2(connection.db);
    writer = await createTestApp(mongo.uri, { ORDERS_DUAL_WRITE: 'true' });
  });

  afterAll(async () => {
    await writer.close();
    await connection.close();
    await mongo.stop();
  });

  async function createOrder(): Promise<string> {
    const response = await request(writer.getHttpServer()).post('/orders').send(validOrder).expect(201);
    return orderBodySchema.parse(response.body).id;
  }

  function findV2(id: string): Promise<unknown> {
    return connection.db.collection('orders_v2').findOne({ _id: new ObjectId(id) });
  }

  it('writes the order to orders and orders_v2 with the same id', async () => {
    const id = await createOrder();

    expect(await findV2(id)).toMatchObject({
      customer: { name: 'Ana', email: 'ana@example.com' },
      totals: { grossCents: 13000, itemCount: 3 },
      status: 'pending',
      schemaVersion: 2,
    });
  });

  it('replicates updates and deletes', async () => {
    const id = await createOrder();

    await request(writer.getHttpServer()).patch(`/orders/${id}`).send({ status: 'PAID' }).expect(200);
    expect(await findV2(id)).toMatchObject({ status: 'paid' });

    await request(writer.getHttpServer()).delete(`/orders/${id}`).expect(204);
    expect(await findV2(id)).toBeNull();
  });

  it('serves identical responses when reads switch to orders_v2', async () => {
    const id = await createOrder();
    const fromV1 = await request(writer.getHttpServer()).get(`/orders/${id}`).expect(200);
    const reader = await createTestApp(mongo.uri, { ORDERS_DUAL_WRITE: 'true', ORDERS_READ_FROM_V2: 'true' });

    try {
      const fromV2 = await request(reader.getHttpServer()).get(`/orders/${id}`).expect(200);
      const pageFromV2 = await request(reader.getHttpServer()).get('/orders').query({ limit: 100 }).expect(200);

      expect(fromV2.body).toEqual(fromV1.body);
      expect(pageSchema.parse(pageFromV2.body).data.map((order) => order.id)).toContain(id);
    } finally {
      await reader.close();
    }
  });

  it('rolls back the orders write when the orders_v2 write fails', async () => {
    const before = await connection.db.collection('orders').countDocuments();
    await connection.db.command({
      collMod: 'orders_v2',
      validator: { $jsonSchema: { required: ['fieldThatDoesNotExist'] } },
    });

    try {
      await request(writer.getHttpServer()).post('/orders').send(validOrder).expect(500);

      expect(await connection.db.collection('orders').countDocuments()).toBe(before);
    } finally {
      await createOrdersV2(connection.db);
    }
  });
});
