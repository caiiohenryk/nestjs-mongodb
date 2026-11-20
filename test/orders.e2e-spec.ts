import request from 'supertest';
import { z } from 'zod';
import { type MongoMemory, startMongoMemory } from './support/mongo-memory.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const orderBodySchema = z.object({
  id: z.string(),
  customerName: z.string(),
  totalCents: z.number(),
  status: z.string(),
});

const pageBodySchema = z.object({
  data: z.array(orderBodySchema),
  nextCursor: z.string().nullable(),
});

type OrderBody = z.infer<typeof orderBodySchema>;

const validOrder = {
  customerName: 'Ana',
  customerEmail: 'Ana@Example.com',
  items: [
    { sku: 'A1', name: 'Mouse', quantity: 2, unitPriceCents: 5000 },
    { sku: 'B7', name: 'Pad', quantity: 1, unitPriceCents: 3000 },
  ],
};

const missingId = '6740a1b2c3d4e5f6a7b8c9d0';

describe('Orders (e2e)', () => {
  let mongo: MongoMemory;
  let app: TestApp;

  beforeAll(async () => {
    mongo = await startMongoMemory('orders_e2e');
    app = await createTestApp(mongo.uri);
  });

  afterAll(async () => {
    await app.close();
    await mongo.stop();
  });

  async function createOrder(overrides: Partial<typeof validOrder> = {}): Promise<OrderBody> {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .send({ ...validOrder, ...overrides })
      .expect(201);
    return orderBodySchema.parse(response.body);
  }

  it('creates an order with computed total and lowercase email', async () => {
    const response = await request(app.getHttpServer()).post('/orders').send(validOrder);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      customerEmail: 'ana@example.com',
      totalCents: 13000,
      status: 'PENDING',
    });
    expect(response.body).toHaveProperty('id');
    expect(response.body).not.toHaveProperty('_id');
  });

  it('rejects invalid payloads and unknown fields with 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .send({ ...validOrder, items: [], hacker: true });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: 'BAD_REQUEST' });
  });

  it('returns an order by id', async () => {
    const created = await createOrder();

    const response = await request(app.getHttpServer()).get(`/orders/${created.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: created.id });
  });

  it('returns 400 for malformed ids and 404 for missing orders', async () => {
    await request(app.getHttpServer()).get('/orders/not-an-id').expect(400);
    await request(app.getHttpServer()).get(`/orders/${missingId}`).expect(404);
  });

  it('updates fields and recomputes the total', async () => {
    const created = await createOrder();

    const response = await request(app.getHttpServer())
      .patch(`/orders/${created.id}`)
      .send({ status: 'PAID', items: [{ sku: 'C3', name: 'Cable', quantity: 3, unitPriceCents: 300 }] });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'PAID', totalCents: 900 });
  });

  it('refuses to change a canceled order with 422', async () => {
    const created = await createOrder();
    await request(app.getHttpServer()).patch(`/orders/${created.id}`).send({ status: 'CANCELED' }).expect(200);

    const response = await request(app.getHttpServer()).patch(`/orders/${created.id}`).send({ customerName: 'Bia' });

    expect(response.status).toBe(422);
  });

  it('rejects going back from paid to pending with 422', async () => {
    const created = await createOrder();
    await request(app.getHttpServer()).patch(`/orders/${created.id}`).send({ status: 'PAID' }).expect(200);

    const response = await request(app.getHttpServer()).patch(`/orders/${created.id}`).send({ status: 'PENDING' });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ message: 'Order cannot change from PAID to PENDING' });
  });

  it('never applies concurrent changes to an order that was canceled', async () => {
    const created = await createOrder();
    await request(app.getHttpServer()).patch(`/orders/${created.id}`).send({ status: 'CANCELED' }).expect(200);

    const responses = await Promise.all(
      ['Bia', 'Caio', 'Duda'].map((customerName) =>
        request(app.getHttpServer()).patch(`/orders/${created.id}`).send({ customerName }),
      ),
    );
    const current = await request(app.getHttpServer()).get(`/orders/${created.id}`);

    expect(responses.map((response) => response.status)).toEqual([422, 422, 422]);
    expect(current.body).toMatchObject({ customerName: 'Ana', status: 'CANCELED' });
  });

  it('deletes an order and then returns 404', async () => {
    const created = await createOrder();

    await request(app.getHttpServer()).delete(`/orders/${created.id}`).expect(204);
    await request(app.getHttpServer()).delete(`/orders/${created.id}`).expect(404);
  });

  it('paginates by cursor without repeating orders', async () => {
    const email = 'pages@example.com';
    for (let index = 0; index < 5; index += 1) {
      await createOrder({ customerEmail: email, customerName: `Customer ${index}` });
    }

    const first = await request(app.getHttpServer()).get('/orders').query({ customerEmail: email, limit: 2 });
    const firstPage = pageBodySchema.parse(first.body);
    const second = await request(app.getHttpServer())
      .get('/orders')
      .query({ customerEmail: email, limit: 2, cursor: firstPage.nextCursor });
    const secondPage = pageBodySchema.parse(second.body);
    const third = await request(app.getHttpServer())
      .get('/orders')
      .query({ customerEmail: email, limit: 2, cursor: secondPage.nextCursor });
    const thirdPage = pageBodySchema.parse(third.body);

    const names = [...firstPage.data, ...secondPage.data, ...thirdPage.data].map((order) => order.customerName);
    expect(names).toEqual(['Customer 4', 'Customer 3', 'Customer 2', 'Customer 1', 'Customer 0']);
    expect(thirdPage.nextCursor).toBeNull();
  });

  it('rejects limits above the maximum and invalid cursors', async () => {
    await request(app.getHttpServer()).get('/orders').query({ limit: 101 }).expect(400);
    await request(app.getHttpServer()).get('/orders').query({ cursor: 'garbage' }).expect(400);
  });
});
