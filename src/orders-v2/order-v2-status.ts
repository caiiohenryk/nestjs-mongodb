export const OrderV2Status = {
  Pending: 'pending',
  Paid: 'paid',
  Canceled: 'canceled',
} as const;

export type OrderV2Status = (typeof OrderV2Status)[keyof typeof OrderV2Status];

export const ORDER_V2_STATUSES: readonly OrderV2Status[] = Object.values(OrderV2Status);
