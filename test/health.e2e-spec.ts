import request from 'supertest';
import { type MongoMemory, startMongoMemory } from './support/mongo-memory.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('Health (e2e)', () => {
  let mongo: MongoMemory;
  let app: TestApp;

  beforeAll(async () => {
    mongo = await startMongoMemory();
    app = await createTestApp(mongo.uri);
  });

  afterAll(async () => {
    await app.close();
    await mongo.stop();
  });

  it('reports mongodb as up', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', info: { mongodb: { status: 'up' } } });
  });

  it('returns the standard error body for unknown routes', async () => {
    const response = await request(app.getHttpServer()).get('/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ statusCode: 404, error: 'NOT_FOUND', path: '/does-not-exist' });
    expect(response.body).toHaveProperty('timestamp');
  });
});
