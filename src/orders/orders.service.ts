import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { decodeCursor, encodeCursor } from '../common/pagination/cursor.js';
import type { PageResponse } from '../common/pagination/page.response.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';
import type { OrderResponse } from './dto/order.response.js';
import type { QueryOrderDto } from './dto/query-order.dto.js';
import type { UpdateOrderDto } from './dto/update-order.dto.js';
import { OrderStatus } from './order-status.js';
import { calculateTotalCents } from './order-total.js';
import { toOrderResponse } from './orders.mapper.js';
import { type OrderChanges, OrdersRepository } from './orders.repository.js';
import type { OrderRecord } from './schemas/order.schema.js';

@Injectable()
export class OrdersService {
  constructor(private readonly ordersRepository: OrdersRepository) {}

  async create(dto: CreateOrderDto): Promise<OrderResponse> {
    const order = await this.ordersRepository.insert({
      customerName: dto.customerName,
      customerEmail: dto.customerEmail,
      items: dto.items,
      totalCents: calculateTotalCents(dto.items),
      status: OrderStatus.Pending,
    });
    return toOrderResponse(order);
  }

  async findById(id: string): Promise<OrderResponse> {
    return toOrderResponse(await this.getExisting(id));
  }

  async findPage(query: QueryOrderDto): Promise<PageResponse<OrderResponse>> {
    const records = await this.ordersRepository.findPage(
      { status: query.status, customerEmail: query.customerEmail },
      { cursor: query.cursor === undefined ? null : decodeCursor(query.cursor), limit: query.limit },
    );
    const page = records.slice(0, query.limit);
    const last = page.at(-1);
    const hasMore = records.length > query.limit && last !== undefined;
    return {
      data: page.map(toOrderResponse),
      nextCursor: hasMore ? encodeCursor({ createdAt: last.createdAt, id: last._id.toHexString() }) : null,
    };
  }

  async update(id: string, dto: UpdateOrderDto): Promise<OrderResponse> {
    const existing = await this.getExisting(id);
    if (existing.status === OrderStatus.Canceled) {
      throw new UnprocessableEntityException('Canceled orders cannot be changed');
    }
    const changes: OrderChanges = {
      ...(dto.customerName !== undefined && { customerName: dto.customerName }),
      ...(dto.customerEmail !== undefined && { customerEmail: dto.customerEmail }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.items !== undefined && { items: dto.items, totalCents: calculateTotalCents(dto.items) }),
    };
    const updated = await this.ordersRepository.updateById(id, changes);
    if (updated === null) {
      throw this.notFound(id);
    }
    return toOrderResponse(updated);
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.ordersRepository.deleteById(id);
    if (!deleted) {
      throw this.notFound(id);
    }
  }

  private async getExisting(id: string): Promise<OrderRecord> {
    const order = await this.ordersRepository.findById(id);
    if (order === null) {
      throw this.notFound(id);
    }
    return order;
  }

  private notFound(id: string): NotFoundException {
    return new NotFoundException(`Order ${id} not found`);
  }
}
