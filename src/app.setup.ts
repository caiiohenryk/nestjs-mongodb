import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { AppConfigService } from './config/app-config.service.js';
import { setupDocs } from './docs.setup.js';

export function configureApp<T extends INestApplication>(app: T): T {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  if (!app.get(AppConfigService).isProduction) {
    setupDocs(app);
  }
  return app;
}
