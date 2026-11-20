import request from 'supertest';
import { z } from 'zod';
import { type MongoMemory, startMongoMemory } from './support/mongo-memory.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const orderBodySchema = z.object({ id: z.string() }).loose();

describe('Orders optimistic concurrency (e2e)', () => {
  let mongo: MongoMemory;
  let app: TestApp;

  beforeAll(async () => {
    mongo = await startMongoMemory('orders_optimistic_e2e');
    app = await createTestApp(mongo.uri);
  });

  afterAll(async () => {
    await app.close();
    await mongo.stop();
  });

  async function createOrder(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .send({
        customerName: 'Ana',
        customerEmail: 'ana@example.com',
        items: [{ sku: 'A1', name: 'Mouse', quantity: 1, unitPriceCents: 100 }],
      })
      .expect(201);
    return orderBodySchema.parse(response.body).id;
  }

  async function etagOf(id: string): Promise<string> {
    const response = await request(app.getHttpServer()).get(`/orders/${id}`).expect(200);
    return z.string().parse(response.headers.etag);
  }

  it('accepts an update carrying the current etag and returns a new one', async () => {
    const id = await createOrder();
    const etag = await etagOf(id);

    const response = await request(app.getHttpServer())
      .patch(`/orders/${id}`)
      .set('If-Match', etag)
      .send({ customerName: 'Bia' });

    expect(response.status).toBe(200);
    expect(response.headers.etag).toEqual(expect.stringMatching(/^"\d+"$/));
    expect(response.headers.etag).not.toBe(etag);
  });

  it('rejects a lost update with 412 and keeps the first write', async () => {
    const id = await createOrder();
    const staleEtag = await etagOf(id);
    await request(app.getHttpServer()).patch(`/orders/${id}`).set('If-Match', staleEtag).send({ customerName: 'Bia' });

    const response = await request(app.getHttpServer())
      .patch(`/orders/${id}`)
      .set('If-Match', staleEtag)
      .send({ customerName: 'Caio' });
    const current = await request(app.getHttpServer()).get(`/orders/${id}`);

    expect(response.status).toBe(412);
    expect(current.body).toMatchObject({ customerName: 'Bia' });
  });

  it('keeps last write wins when no precondition is sent', async () => {
    const id = await createOrder();

    await request(app.getHttpServer()).patch(`/orders/${id}`).send({ customerName: 'Bia' }).expect(200);
    await request(app.getHttpServer()).patch(`/orders/${id}`).send({ customerName: 'Caio' }).expect(200);
  });

  it('rejects malformed etags with 400', async () => {
    const id = await createOrder();

    await request(app.getHttpServer())
      .patch(`/orders/${id}`)
      .set('If-Match', 'nope')
      .send({ customerName: 'X' })
      .expect(400);
  });
});
