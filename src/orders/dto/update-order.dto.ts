import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsOptional } from 'class-validator';
import { ORDER_STATUSES, type OrderStatus } from '../order-status.js';
import { CreateOrderDto } from './create-order.dto.js';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OrderStatus;
}
