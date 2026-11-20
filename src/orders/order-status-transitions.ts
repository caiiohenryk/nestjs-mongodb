import { ORDER_STATUSES, OrderStatus } from './order-status.js';

const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.Pending]: [OrderStatus.Pending, OrderStatus.Paid, OrderStatus.Canceled],
  [OrderStatus.Paid]: [OrderStatus.Paid, OrderStatus.Canceled],
  [OrderStatus.Canceled]: [],
};

export function statusesAllowedToBecome(target: OrderStatus | undefined): OrderStatus[] {
  return ORDER_STATUSES.filter((from) =>
    target === undefined ? ORDER_STATUS_TRANSITIONS[from].length > 0 : ORDER_STATUS_TRANSITIONS[from].includes(target),
  );
}
