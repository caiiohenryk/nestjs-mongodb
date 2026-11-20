import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { buildPage } from '../common/pagination/build-page.js';
import { cursorOf, decodeCursor } from '../common/pagination/cursor.js';
import type { PageResponse } from '../common/pagination/page.response.js';
import type { DailyRevenueRange, DailyRevenueRow } from '../common/reports/daily-revenue.js';
import { AppConfigService } from '../config/app-config.service.js';
import { OrdersV2Repository } from '../orders-v2/index.js';
import type { DailyRevenueResponse } from './dto/daily-revenue.response.js';
import type { OrderResponse } from './dto/order.response.js';
import type { QueryDailyRevenueDto } from './dto/query-daily-revenue.dto.js';
import type { QueryOrderDto } from './dto/query-order.dto.js';
import { fromOrderV2Record, toOrderV2Status } from './orders-v2.mapper.js';
import { toOrderResponse } from './orders.mapper.js';
import { OrdersRepository } from './orders.repository.js';

const MAX_REPORT_DAYS = 366;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function toReportRange(query: QueryDailyRevenueDto): DailyRevenueRange {
  const range = { from: new Date(query.from), to: new Date(query.to) };
  if (range.to.getTime() <= range.from.getTime()) {
    throw new BadRequestException('to must be after from');
  }
  if (range.to.getTime() - range.from.getTime() > MAX_REPORT_DAYS * DAY_IN_MS) {
    throw new BadRequestException(`The report range cannot exceed ${MAX_REPORT_DAYS} days`);
  }
  return range;
}

function toDailyRevenueResponse(range: DailyRevenueRange, rows: readonly DailyRevenueRow[]): DailyRevenueResponse {
  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    days: rows.map((row) => ({
      day: row._id.toISOString().slice(0, 10),
      orderCount: row.orderCount,
      grossCents: row.grossCents,
    })),
  };
}

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

  async dailyRevenue(query: QueryDailyRevenueDto): Promise<DailyRevenueResponse> {
    const range = toReportRange(query);
    const rows = this.config.ordersReadFromV2
      ? await this.ordersV2Repository.aggregateDailyRevenue(
          range,
          query.status === undefined ? undefined : toOrderV2Status(query.status),
        )
      : await this.ordersRepository.aggregateDailyRevenue(range, query.status);
    return toDailyRevenueResponse(range, rows);
  }
}
