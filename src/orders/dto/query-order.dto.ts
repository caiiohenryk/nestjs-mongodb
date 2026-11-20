import { IsEmail, IsIn, IsOptional } from 'class-validator';
import { CursorQueryDto } from '../../common/pagination/cursor-query.dto.js';
import { ORDER_STATUSES, type OrderStatus } from '../order-status.js';

export class QueryOrderDto extends CursorQueryDto {
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OrderStatus;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;
}
