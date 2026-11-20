import request from 'supertest';
import { z } from 'zod';
import { type MongoMemory, startMongoMemory } from './support/mongo-memory.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const operation = z.object({ responses: z.record(z.string(), z.unknown()) }).loose();

const openApiSchema = z.object({
  openapi: z.string(),
  paths: z.object({
    '/orders': z.object({ get: operation, post: operation }),
    '/orders/{id}': z.object({ get: operation, patch: operation, delete: operation }),
    '/orders/reports/daily-revenue': z.object({ get: operation }),
  }),
  components: z.object({
    schemas: z.object({
      CreateOrderDto: z.unknown(),
      OrderResponse: z.unknown(),
      OrderPageResponse: z.unknown(),
      ErrorResponse: z.unknown(),
    }),
  }),
});

describe('OpenAPI docs (e2e)', () => {
  let mongo: MongoMemory;
  let app: TestApp;

  beforeAll(async () => {
    mongo = await startMongoMemory('docs_e2e');
    app = await createTestApp(mongo.uri);
  });

  afterAll(async () => {
    await app.close();
    await mongo.stop();
  });

  it('serves an openapi document describing the orders api', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json');

    expect(response.status).toBe(200);
    const document = openApiSchema.parse(response.body);
    expect(Object.keys(document.paths['/orders'].post.responses)).toEqual(expect.arrayContaining(['201', '400']));
    expect(Object.keys(document.paths['/orders/{id}'].patch.responses)).toEqual(
      expect.arrayContaining(['200', '404', '422']),
    );
  });

  it('serves the swagger ui', async () => {
    const response = await request(app.getHttpServer()).get('/docs');

    expect(response.status).toBe(200);
    expect(response.text).toContain('swagger');
  });
});
