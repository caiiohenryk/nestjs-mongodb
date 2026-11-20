import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { AppConfigService } from '../../src/config/app-config.service.js';
import { type Env, validateEnv } from '../../src/config/env.schema.js';

export type TestApp = INestApplication<App>;

function createTestConfig(mongodbUri: string): AppConfigService {
  const env = validateEnv({ NODE_ENV: 'test', MONGODB_URI: mongodbUri });
  return new AppConfigService(new ConfigService<Env, true>(env));
}

export async function createTestApp(mongodbUri: string): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AppConfigService)
    .useValue(createTestConfig(mongodbUri))
    .compile();
  const app = configureApp(moduleRef.createNestApplication<TestApp>());
  await app.init();
  return app;
}
