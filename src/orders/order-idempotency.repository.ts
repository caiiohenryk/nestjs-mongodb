import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model, Types } from 'mongoose';
import { OrderIdempotencyKey } from './schemas/order-idempotency-key.schema.js';

export type IdempotencyRecord = {
  readonly _id: string;
  readonly requestHash: string;
  readonly orderId: Types.ObjectId;
};

@Injectable()
export class OrderIdempotencyRepository {
  constructor(@InjectModel(OrderIdempotencyKey.name) private readonly keyModel: Model<OrderIdempotencyKey>) {}

  findByKey(key: string, session: ClientSession | null): Promise<IdempotencyRecord | null> {
    return this.keyModel
      .findById(key)
      .select({ requestHash: 1, orderId: 1 })
      .session(session)
      .lean<IdempotencyRecord>()
      .exec();
  }

  async insert(record: IdempotencyRecord, session: ClientSession): Promise<void> {
    await new this.keyModel(record).save({ session });
  }
}
