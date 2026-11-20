import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import { ORDER_STATUSES, OrderStatus } from '../order-status.js';

export const ORDER_SCHEMA_VERSION = 1;
export const MAX_ORDER_ITEMS = 50;

const integer = { validator: Number.isInteger, message: '{PATH} must be an integer' };

@Schema({ _id: false })
export class OrderItem {
  @Prop({ required: true, trim: true, maxlength: 64 })
  sku: string;

  @Prop({ required: true, trim: true, maxlength: 200 })
  name: string;

  @Prop({ required: true, min: 1, max: 1000, validate: integer })
  quantity: number;

  @Prop({ required: true, min: 0, validate: integer })
  unitPriceCents: number;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

function hasAllowedItemCount(items: readonly OrderItem[]): boolean {
  return items.length >= 1 && items.length <= MAX_ORDER_ITEMS;
}

@Schema({ collection: 'orders', timestamps: true, versionKey: false })
export class Order {
  @Prop({ required: true, trim: true, maxlength: 200 })
  customerName: string;

  @Prop({ required: true, trim: true, lowercase: true, maxlength: 254 })
  customerEmail: string;

  @Prop({
    type: [OrderItemSchema],
    required: true,
    validate: { validator: hasAllowedItemCount, message: `{PATH} must have between 1 and ${MAX_ORDER_ITEMS} items` },
  })
  items: OrderItem[];

  @Prop({ required: true, min: 0, validate: integer })
  totalCents: number;

  @Prop({ type: String, required: true, enum: ORDER_STATUSES, default: OrderStatus.Pending })
  status: OrderStatus;

  @Prop({ required: true, default: ORDER_SCHEMA_VERSION })
  schemaVersion: number;

  createdAt: Date;

  updatedAt: Date;
}

export type OrderDocument = HydratedDocument<Order>;

export type OrderRecord = Order & { readonly _id: Types.ObjectId };

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ createdAt: -1, _id: -1 }, { name: 'createdAt_id' });
OrderSchema.index({ status: 1, createdAt: -1, _id: -1 }, { name: 'status_createdAt_id' });
OrderSchema.index({ customerEmail: 1, createdAt: -1, _id: -1 }, { name: 'customerEmail_createdAt_id' });
