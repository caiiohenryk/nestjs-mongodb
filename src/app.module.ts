import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { OrdersModule } from './orders/orders.module.js';

@Module({
  imports: [AppConfigModule, DatabaseModule, HealthModule, OrdersModule],
})
export class AppModule {}
