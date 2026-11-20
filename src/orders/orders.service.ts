import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import type { CreateOrderDto } from './dto/create-order.dto.js';
import type { OrderResponse } from './dto/order.response.js';
import type { UpdateOrderDto } from './dto/update-order.dto.js';
import { OrderStatus } from './order-status.js';
import { statusesAllowedToBecome } from './order-status-transitions.js';
import { calculateTotalCents } from './order-total.js';
import { OrdersV2Replicator } from './orders-v2.replicator.js';
import { toOrderResponse } from './orders.mapper.js';
import { type OrderChanges, OrdersRepository } from './orders.repository.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly replicator: OrdersV2Replicator,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async create(dto: CreateOrderDto): Promise<OrderResponse> {
    const order = await this.connection.transaction(async (session) => {
      const inserted = await this.ordersRepository.insert(
        {
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          items: dto.items,
          totalCents: calculateTotalCents(dto.items),
          status: OrderStatus.Pending,
        },
        session,
      );
      await this.replicator.replicate(inserted, session);
      return inserted;
    });
    return toOrderResponse(order);
  }

  async update(id: string, dto: UpdateOrderDto): Promise<OrderResponse> {
    const changes: OrderChanges = {
      ...(dto.customerName !== undefined && { customerName: dto.customerName }),
      ...(dto.customerEmail !== undefined && { customerEmail: dto.customerEmail }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.items !== undefined && { items: dto.items, totalCents: calculateTotalCents(dto.items) }),
    };
    const allowedFrom = statusesAllowedToBecome(dto.status);
    const updated = await this.connection.transaction(async (session) => {
      const record = await this.ordersRepository.updateById(id, { changes, allowedFrom }, session);
      if (record !== null) {
        await this.replicator.replicate(record, session);
      }
      return record;
    });
    if (updated === null) {
      throw await this.explainRejectedUpdate(id, dto.status);
    }
    return toOrderResponse(updated);
  }

  async remove(id: string): Promise<void> {
    await this.connection.transaction(async (session) => {
      const deleted = await this.ordersRepository.deleteById(id, session);
      if (!deleted) {
        throw this.notFound(id);
      }
      await this.replicator.remove(id, session);
    });
  }

  private async explainRejectedUpdate(
    id: string,
    target: OrderStatus | undefined,
  ): Promise<NotFoundException | UnprocessableEntityException> {
    const current = await this.ordersRepository.findById(id);
    if (current === null) {
      return this.notFound(id);
    }
    if (target === undefined) {
      return new UnprocessableEntityException(`Orders with status ${current.status} cannot be changed`);
    }
    return new UnprocessableEntityException(`Order cannot change from ${current.status} to ${target}`);
  }

  private notFound(id: string): NotFoundException {
    return new NotFoundException(`Order ${id} not found`);
  }
}
