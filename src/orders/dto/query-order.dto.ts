import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional } from 'class-validator';
import { CursorQueryDto } from '../../common/pagination/cursor-query.dto.js';
import { ORDER_STATUSES, type OrderStatus } from '../order-status.js';

export class QueryOrderDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: ORDER_STATUSES })
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OrderStatus;

  @ApiPropertyOptional({ example: 'ana@example.com' })
  @IsOptional()
  @IsEmail()
  customerEmail?: string;
}
