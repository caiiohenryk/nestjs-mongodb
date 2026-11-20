import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';

export type TestApp = INestApplication<App>;

export async function createTestApp(mongodbUri: string): Promise<TestApp> {
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongodbUri;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(moduleRef.createNestApplication<TestApp>());
  await app.init();
  return app;
}
