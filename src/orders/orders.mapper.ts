import type { OrderResponse } from './dto/order.response.js';
import type { OrderRecord } from './schemas/order.schema.js';

export function toOrderResponse(order: OrderRecord): OrderResponse {
  return {
    id: order._id.toHexString(),
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    items: order.items.map((item) => ({
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
    })),
    totalCents: order.totalCents,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
