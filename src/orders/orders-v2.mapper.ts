import { ORDER_V2_SCHEMA_VERSION, type OrderV2Record, OrderV2Status } from '../orders-v2/index.js';
import type { OrderResponse } from './dto/order.response.js';
import { OrderStatus } from './order-status.js';
import type { OrderRecord } from './schemas/order.schema.js';

const TO_V2_STATUS: Record<OrderStatus, OrderV2Status> = {
  [OrderStatus.Pending]: OrderV2Status.Pending,
  [OrderStatus.Paid]: OrderV2Status.Paid,
  [OrderStatus.Canceled]: OrderV2Status.Canceled,
};

const FROM_V2_STATUS: Record<OrderV2Status, OrderStatus> = {
  [OrderV2Status.Pending]: OrderStatus.Pending,
  [OrderV2Status.Paid]: OrderStatus.Paid,
  [OrderV2Status.Canceled]: OrderStatus.Canceled,
};

export function toOrderV2Record(order: OrderRecord, syncedAt: Date): OrderV2Record {
  const items = order.items.map((item) => ({
    sku: item.sku,
    name: item.name,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    subtotalCents: item.quantity * item.unitPriceCents,
  }));
  return {
    _id: order._id,
    customer: { name: order.customerName, email: order.customerEmail },
    items,
    totals: {
      grossCents: order.totalCents,
      itemCount: items.reduce((count, item) => count + item.quantity, 0),
    },
    status: TO_V2_STATUS[order.status],
    schemaVersion: ORDER_V2_SCHEMA_VERSION,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    syncedAt,
  };
}

export function fromOrderV2Record(order: OrderV2Record): OrderResponse {
  return {
    id: order._id.toHexString(),
    customerName: order.customer.name,
    customerEmail: order.customer.email,
    items: order.items.map((item) => ({
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
    })),
    totalCents: order.totals.grossCents,
    status: FROM_V2_STATUS[order.status],
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export function toOrderV2Status(status: OrderStatus): OrderV2Status {
  return TO_V2_STATUS[status];
}
