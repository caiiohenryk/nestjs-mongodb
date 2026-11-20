import { Types } from 'mongoose';
import { OrderStatus } from '../order-status.js';
import type { OrderRecord } from '../schemas/order.schema.js';

export function buildOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    _id: new Types.ObjectId('6740a1b2c3d4e5f6a7b8c9d0'),
    customerName: 'Ana',
    customerEmail: 'ana@example.com',
    items: [{ sku: 'A1', name: 'Mouse', quantity: 2, unitPriceCents: 5000 }],
    totalCents: 10000,
    status: OrderStatus.Pending,
    schemaVersion: 1,
    createdAt: new Date('2026-11-20T10:00:00.000Z'),
    updatedAt: new Date('2026-11-20T10:00:00.000Z'),
    ...overrides,
  };
}
