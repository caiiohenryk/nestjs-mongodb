import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional } from 'class-validator';
import { ORDER_STATUSES, type OrderStatus } from '../order-status.js';

export class QueryDailyRevenueDto {
  @ApiProperty({ example: '2026-06-01T00:00:00Z', description: 'Inclusive start (UTC)' })
  @IsISO8601({ strict: true })
  from: string;

  @ApiProperty({ example: '2026-07-01T00:00:00Z', description: 'Exclusive end (UTC), at most 366 days after from' })
  @IsISO8601({ strict: true })
  to: string;

  @ApiPropertyOptional({ enum: ORDER_STATUSES })
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OrderStatus;
}
