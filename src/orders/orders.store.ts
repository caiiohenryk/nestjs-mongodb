import { Injectable } from '@nestjs/common';
import type { ClientSession } from 'mongoose';
import { AppConfigService } from '../config/app-config.service.js';
import { OrdersV2Repository } from '../orders-v2/index.js';
import { toOrderV2Record } from './orders-v2.mapper.js';
import { type NewOrder, type OrderUpdate, OrdersRepository } from './orders.repository.js';
import type { OrderRecord } from './schemas/order.schema.js';

@Injectable()
export class OrdersStore {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly ordersV2Repository: OrdersV2Repository,
    private readonly config: AppConfigService,
  ) {}

  findById(id: string): Promise<OrderRecord | null> {
    return this.ordersRepository.findById(id);
  }

  async insert(order: NewOrder, session: ClientSession): Promise<OrderRecord> {
    const inserted = await this.ordersRepository.insert(order, session);
    await this.replicate(inserted, session);
    return inserted;
  }

  async updateById(id: string, update: OrderUpdate, session: ClientSession): Promise<OrderRecord | null> {
    const updated = await this.ordersRepository.updateById(id, update, session);
    if (updated !== null) {
      await this.replicate(updated, session);
    }
    return updated;
  }

  async deleteById(id: string, session: ClientSession): Promise<boolean> {
    const deleted = await this.ordersRepository.deleteById(id, session);
    if (deleted && this.config.ordersDualWrite) {
      await this.ordersV2Repository.deleteById(id, session);
    }
    return deleted;
  }

  private async replicate(order: OrderRecord, session: ClientSession): Promise<void> {
    if (this.config.ordersDualWrite) {
      await this.ordersV2Repository.replicate(toOrderV2Record(order, new Date()), session);
    }
  }
}
