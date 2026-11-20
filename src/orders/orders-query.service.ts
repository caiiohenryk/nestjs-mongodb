import { Injectable, NotFoundException } from '@nestjs/common';
import { buildPage } from '../common/pagination/build-page.js';
import { cursorOf, decodeCursor } from '../common/pagination/cursor.js';
import type { PageResponse } from '../common/pagination/page.response.js';
import { AppConfigService } from '../config/app-config.service.js';
import { OrdersV2Repository } from '../orders-v2/index.js';
import type { OrderResponse } from './dto/order.response.js';
import type { QueryOrderDto } from './dto/query-order.dto.js';
import { fromOrderV2Record, toOrderV2Status } from './orders-v2.mapper.js';
import { toOrderResponse } from './orders.mapper.js';
import { OrdersRepository } from './orders.repository.js';

@Injectable()
export class OrdersQueryService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly ordersV2Repository: OrdersV2Repository,
    private readonly config: AppConfigService,
  ) {}

  async findById(id: string): Promise<OrderResponse> {
    const order = this.config.ordersReadFromV2
      ? await this.ordersV2Repository.findById(id).then((record) => record && fromOrderV2Record(record))
      : await this.ordersRepository.findById(id).then((record) => record && toOrderResponse(record));
    if (order === null) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }

  async findPage(query: QueryOrderDto): Promise<PageResponse<OrderResponse>> {
    const page = { cursor: query.cursor === undefined ? null : decodeCursor(query.cursor), limit: query.limit };
    if (this.config.ordersReadFromV2) {
      const status = query.status === undefined ? undefined : toOrderV2Status(query.status);
      const records = await this.ordersV2Repository.findPage({ status, customerEmail: query.customerEmail }, page);
      return buildPage({ records, limit: query.limit, toResponse: fromOrderV2Record, cursorOf });
    }
    const records = await this.ordersRepository.findPage(
      { status: query.status, customerEmail: query.customerEmail },
      page,
    );
    return buildPage({ records, limit: query.limit, toResponse: toOrderResponse, cursorOf });
  }
}
