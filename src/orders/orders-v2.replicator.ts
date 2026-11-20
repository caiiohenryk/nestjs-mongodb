import { Injectable } from '@nestjs/common';
import type { ClientSession } from 'mongoose';
import { AppConfigService } from '../config/app-config.service.js';
import { OrdersV2Repository } from '../orders-v2/index.js';
import { toOrderV2Record } from './orders-v2.mapper.js';
import type { OrderRecord } from './schemas/order.schema.js';

@Injectable()
export class OrdersV2Replicator {
  constructor(
    private readonly ordersV2Repository: OrdersV2Repository,
    private readonly config: AppConfigService,
  ) {}

  async replicate(order: OrderRecord, session: ClientSession): Promise<void> {
    if (!this.config.ordersDualWrite) {
      return;
    }
    await this.ordersV2Repository.replicate(toOrderV2Record(order, new Date()), session);
  }

  async remove(id: string, session: ClientSession): Promise<void> {
    if (!this.config.ordersDualWrite) {
      return;
    }
    await this.ordersV2Repository.deleteById(id, session);
  }
}
