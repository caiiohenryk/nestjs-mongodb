import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersV2Module } from '../orders-v2/index.js';
import { OrdersQueryService } from './orders-query.service.js';
import { OrdersV2Replicator } from './orders-v2.replicator.js';
import { OrdersController } from './orders.controller.js';
import { OrdersRepository } from './orders.repository.js';
import { OrdersService } from './orders.service.js';
import { Order, OrderSchema } from './schemas/order.schema.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]), OrdersV2Module],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersQueryService, OrdersRepository, OrdersV2Replicator],
})
export class OrdersModule {}
