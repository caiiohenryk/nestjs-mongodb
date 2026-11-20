import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type ClientSession, type Model, type QueryFilter, Types } from 'mongoose';
import type { Cursor } from '../common/pagination/cursor.js';
import type { OrderV2Status } from './order-v2-status.js';
import { OrderV2, type OrderV2Record } from './schemas/order-v2.schema.js';

export type OrderV2Filter = {
  readonly status?: OrderV2Status;
  readonly customerEmail?: string;
};

export type OrderV2PageRequest = {
  readonly cursor: Cursor | null;
  readonly limit: number;
};

const ORDER_V2_PROJECTION = {
  customer: 1,
  items: 1,
  totals: 1,
  status: 1,
  schemaVersion: 1,
  createdAt: 1,
  updatedAt: 1,
  syncedAt: 1,
} as const;

function afterCursor(cursor: Cursor): QueryFilter<OrderV2> {
  return {
    $or: [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: new Types.ObjectId(cursor.id) } },
    ],
  };
}

@Injectable()
export class OrdersV2Repository {
  constructor(@InjectModel(OrderV2.name) private readonly orderV2Model: Model<OrderV2>) {}

  async replicate(order: OrderV2Record, session: ClientSession): Promise<void> {
    await this.orderV2Model
      .replaceOne({ _id: order._id }, order, { upsert: true, session, runValidators: true })
      .exec();
  }

  findById(id: string): Promise<OrderV2Record | null> {
    return this.orderV2Model.findById(id).select(ORDER_V2_PROJECTION).lean<OrderV2Record>().exec();
  }

  findPage(filter: OrderV2Filter, page: OrderV2PageRequest): Promise<OrderV2Record[]> {
    const query: QueryFilter<OrderV2> = {
      ...(filter.status !== undefined && { status: filter.status }),
      ...(filter.customerEmail !== undefined && { 'customer.email': filter.customerEmail.toLowerCase() }),
      ...(page.cursor !== null && afterCursor(page.cursor)),
    };
    return this.orderV2Model
      .find(query)
      .select(ORDER_V2_PROJECTION)
      .sort({ createdAt: -1, _id: -1 })
      .limit(page.limit + 1)
      .lean<OrderV2Record[]>()
      .exec();
  }

  async deleteById(id: string, session: ClientSession): Promise<void> {
    await this.orderV2Model.deleteOne({ _id: id }, { session }).exec();
  }
}
