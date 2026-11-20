import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersV2Repository } from './orders-v2.repository.js';
import { OrderV2, OrderV2Schema } from './schemas/order-v2.schema.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: OrderV2.name, schema: OrderV2Schema }])],
  providers: [OrdersV2Repository],
  exports: [OrdersV2Repository],
})
export class OrdersV2Module {}
