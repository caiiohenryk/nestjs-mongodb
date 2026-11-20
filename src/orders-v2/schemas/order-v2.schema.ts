import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import { ORDER_V2_STATUSES, type OrderV2Status } from '../order-v2-status.js';

export const ORDER_V2_SCHEMA_VERSION = 2;

const integer = { validator: Number.isInteger, message: '{PATH} must be an integer' };

@Schema({ _id: false })
export class OrderV2Customer {
  @Prop({ required: true, trim: true, maxlength: 200 })
  name: string;

  @Prop({ required: true, trim: true, lowercase: true, maxlength: 254 })
  email: string;
}

@Schema({ _id: false })
export class OrderV2Item {
  @Prop({ required: true, maxlength: 64 })
  sku: string;

  @Prop({ required: true, maxlength: 200 })
  name: string;

  @Prop({ required: true, min: 1, validate: integer })
  quantity: number;

  @Prop({ required: true, min: 0, validate: integer })
  unitPriceCents: number;

  @Prop({ required: true, min: 0, validate: integer })
  subtotalCents: number;
}

@Schema({ _id: false })
export class OrderV2Totals {
  @Prop({ required: true, min: 0, validate: integer })
  grossCents: number;

  @Prop({ required: true, min: 0, validate: integer })
  itemCount: number;
}

@Schema({ collection: 'orders_v2', timestamps: false, versionKey: false })
export class OrderV2 {
  @Prop({ type: SchemaFactory.createForClass(OrderV2Customer), required: true })
  customer: OrderV2Customer;

  @Prop({ type: [SchemaFactory.createForClass(OrderV2Item)], required: true })
  items: OrderV2Item[];

  @Prop({ type: SchemaFactory.createForClass(OrderV2Totals), required: true })
  totals: OrderV2Totals;

  @Prop({ type: String, required: true, enum: ORDER_V2_STATUSES })
  status: OrderV2Status;

  @Prop({ required: true, default: ORDER_V2_SCHEMA_VERSION })
  schemaVersion: number;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  updatedAt: Date;

  @Prop({ required: true })
  syncedAt: Date;
}

export type OrderV2Document = HydratedDocument<OrderV2>;

export type OrderV2Record = OrderV2 & { readonly _id: Types.ObjectId };

export const OrderV2Schema = SchemaFactory.createForClass(OrderV2);

OrderV2Schema.index({ createdAt: -1, _id: -1 }, { name: 'createdAt_id' });
OrderV2Schema.index({ status: 1, createdAt: -1, _id: -1 }, { name: 'status_createdAt_id' });
OrderV2Schema.index({ 'customer.email': 1, createdAt: -1, _id: -1 }, { name: 'customerEmail_createdAt_id' });
