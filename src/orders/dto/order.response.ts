import type { OrderStatus } from '../order-status.js';

export class OrderItemResponse {
  readonly sku: string;
  readonly name: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
}

export class OrderResponse {
  readonly id: string;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly items: readonly OrderItemResponse[];
  readonly totalCents: number;
  readonly status: OrderStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}
