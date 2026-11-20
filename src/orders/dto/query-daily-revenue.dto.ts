import { IsIn, IsISO8601, IsOptional } from 'class-validator';
import { ORDER_STATUSES, type OrderStatus } from '../order-status.js';

export class QueryDailyRevenueDto {
  @IsISO8601({ strict: true })
  from: string;

  @IsISO8601({ strict: true })
  to: string;

  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OrderStatus;
}
