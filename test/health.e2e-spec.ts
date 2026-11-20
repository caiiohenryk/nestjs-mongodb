import request from 'supertest';
import { ShutdownState } from '../src/health/shutdown.state.js';
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

  it('reports liveness without touching the database', async () => {
    const response = await request(app.getHttpServer()).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', info: {} });
  });

  it('reports readiness when mongodb is a writable primary', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      info: { shutdown: { status: 'up' }, mongodb: { status: 'up' }, mongodbPrimary: { status: 'up' } },
    });
  });

  it('returns the standard error body for unknown routes', async () => {
    const response = await request(app.getHttpServer()).get('/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ statusCode: 404, error: 'NOT_FOUND', path: '/does-not-exist' });
    expect(response.body).toHaveProperty('timestamp');
  });

  it('stops reporting readiness once shutdown starts, while staying live', async () => {
    app.get(ShutdownState).beforeApplicationShutdown();

    const ready = await request(app.getHttpServer()).get('/health/ready');
    const live = await request(app.getHttpServer()).get('/health/live');

    expect(ready.status).toBe(503);
    expect(live.status).toBe(200);
  });
});
