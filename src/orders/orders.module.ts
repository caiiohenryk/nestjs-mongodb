import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersV2Module } from '../orders-v2/index.js';
import { OrdersQueryService } from './orders-query.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersRepository } from './orders.repository.js';
import { OrderIdempotencyRepository } from './order-idempotency.repository.js';
import { OrdersService } from './orders.service.js';
import { OrdersStore } from './orders.store.js';
import { OrderIdempotencyKey, OrderIdempotencyKeySchema } from './schemas/order-idempotency-key.schema.js';
import { Order, OrderSchema } from './schemas/order.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: OrderIdempotencyKey.name, schema: OrderIdempotencyKeySchema },
    ]),
    OrdersV2Module,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersQueryService, OrdersRepository, OrdersStore, OrderIdempotencyRepository],
})
export class OrdersModule {}
