type PricedItem = {
  readonly quantity: number;
  readonly unitPriceCents: number;
};

export function calculateTotalCents(items: readonly PricedItem[]): number {
  return items.reduce((total, item) => total + item.quantity * item.unitPriceCents, 0);
}
