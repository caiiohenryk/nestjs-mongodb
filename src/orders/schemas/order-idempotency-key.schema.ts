import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Types } from 'mongoose';
import { Types as MongooseTypes } from 'mongoose';

export const IDEMPOTENCY_KEY_TTL_SECONDS = 24 * 60 * 60;

@Schema({ collection: 'order_idempotency_keys', timestamps: { createdAt: true, updatedAt: false }, versionKey: false })
export class OrderIdempotencyKey {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true, maxlength: 64 })
  requestHash: string;

  @Prop({ type: MongooseTypes.ObjectId, required: true })
  orderId: Types.ObjectId;

  @Prop({ required: true, default: 1 })
  schemaVersion: number;

  createdAt: Date;
}

export const OrderIdempotencyKeySchema = SchemaFactory.createForClass(OrderIdempotencyKey);

OrderIdempotencyKeySchema.index(
  { createdAt: 1 },
  { name: 'createdAt_ttl', expireAfterSeconds: IDEMPOTENCY_KEY_TTL_SECONDS },
);
