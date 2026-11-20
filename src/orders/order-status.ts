export const OrderStatus = {
  Pending: 'PENDING',
  Paid: 'PAID',
  Canceled: 'CANCELED',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const ORDER_STATUSES: readonly OrderStatus[] = Object.values(OrderStatus);
