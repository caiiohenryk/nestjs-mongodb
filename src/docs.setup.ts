import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupDocs(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('nestjs-mongodb')
    .setDescription('Orders API backed by MongoDB, with cursor pagination and an orders to orders_v2 migration')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config), { jsonDocumentUrl: 'docs-json' });
}
