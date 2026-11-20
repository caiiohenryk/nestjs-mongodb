import { ApiProperty } from '@nestjs/swagger';
import { ORDER_STATUSES, type OrderStatus } from '../order-status.js';

export class OrderItemResponse {
  @ApiProperty()
  readonly sku: string;

  @ApiProperty()
  readonly name: string;

  @ApiProperty()
  readonly quantity: number;

  @ApiProperty({ description: 'Price in cents' })
  readonly unitPriceCents: number;
}

export class OrderResponse {
  @ApiProperty({ example: '6b00be361d93441c0ebd7935' })
  readonly id: string;

  @ApiProperty()
  readonly customerName: string;

  @ApiProperty()
  readonly customerEmail: string;

  @ApiProperty({ type: [OrderItemResponse] })
  readonly items: readonly OrderItemResponse[];

  @ApiProperty({ description: 'Total in cents' })
  readonly totalCents: number;

  @ApiProperty({ enum: ORDER_STATUSES })
  readonly status: OrderStatus;

  @ApiProperty({ format: 'date-time' })
  readonly createdAt: string;

  @ApiProperty({ format: 'date-time' })
  readonly updatedAt: string;
}

export class OrderPageResponse {
  @ApiProperty({ type: [OrderResponse] })
  readonly data: readonly OrderResponse[];

  @ApiProperty({ type: String, nullable: true, description: 'Pass as cursor to fetch the next page' })
  readonly nextCursor: string | null;
}
