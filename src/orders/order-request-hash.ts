import { createHash } from 'node:crypto';
import type { CreateOrderDto } from './dto/create-order.dto.js';

export function hashCreateOrderRequest(dto: CreateOrderDto): string {
  const canonical = {
    customerName: dto.customerName,
    customerEmail: dto.customerEmail.toLowerCase(),
    items: dto.items.map((item) => [item.sku, item.name, item.quantity, item.unitPriceCents]),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
