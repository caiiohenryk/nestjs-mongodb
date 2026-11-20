import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type ClientSession, type Model, type QueryFilter, Types } from 'mongoose';
import type { Cursor } from '../common/pagination/cursor.js';
import type { OrderStatus } from './order-status.js';
import { Order, type OrderItem, type OrderRecord } from './schemas/order.schema.js';

export type NewOrder = {
  readonly customerName: string;
  readonly customerEmail: string;
  readonly items: OrderItem[];
  readonly totalCents: number;
  readonly status: OrderStatus;
};

export type OrderChanges = Partial<NewOrder>;

export type OrderUpdate = {
  readonly changes: OrderChanges;
  readonly allowedFrom: readonly OrderStatus[];
};

export type OrderFilter = {
  readonly status?: OrderStatus;
  readonly customerEmail?: string;
};

export type OrderPageRequest = {
  readonly cursor: Cursor | null;
  readonly limit: number;
};

const ORDER_PROJECTION = {
  customerName: 1,
  customerEmail: 1,
  items: 1,
  totalCents: 1,
  status: 1,
  schemaVersion: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

function afterCursor(cursor: Cursor): QueryFilter<Order> {
  return {
    $or: [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: new Types.ObjectId(cursor.id) } },
    ],
  };
}

@Injectable()
export class OrdersRepository {
  constructor(@InjectModel(Order.name) private readonly orderModel: Model<Order>) {}

  async insert(order: NewOrder, session: ClientSession): Promise<OrderRecord> {
    const created = await new this.orderModel(order).save({ session });
    return created.toObject();
  }

  findById(id: string): Promise<OrderRecord | null> {
    return this.orderModel.findById(id).select(ORDER_PROJECTION).lean<OrderRecord>().exec();
  }

  findPage(filter: OrderFilter, page: OrderPageRequest): Promise<OrderRecord[]> {
    const query: QueryFilter<Order> = {
      ...(filter.status !== undefined && { status: filter.status }),
      ...(filter.customerEmail !== undefined && { customerEmail: filter.customerEmail.toLowerCase() }),
      ...(page.cursor !== null && afterCursor(page.cursor)),
    };
    return this.orderModel
      .find(query)
      .select(ORDER_PROJECTION)
      .sort({ createdAt: -1, _id: -1 })
      .limit(page.limit + 1)
      .lean<OrderRecord[]>()
      .exec();
  }

  updateById(id: string, update: OrderUpdate, session: ClientSession): Promise<OrderRecord | null> {
    return this.orderModel
      .findOneAndUpdate(
        { _id: id, status: { $in: update.allowedFrom } },
        { $set: update.changes },
        { returnDocument: 'after', runValidators: true, session },
      )
      .select(ORDER_PROJECTION)
      .lean<OrderRecord>()
      .exec();
  }

  async deleteById(id: string, session: ClientSession): Promise<boolean> {
    const result = await this.orderModel.deleteOne({ _id: id }, { session }).exec();
    return result.deletedCount === 1;
  }
}
