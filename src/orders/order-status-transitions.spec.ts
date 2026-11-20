import { OrderStatus } from './order-status.js';
import { statusesAllowedToBecome } from './order-status-transitions.js';

describe('statusesAllowedToBecome', () => {
  it('allows field changes on any order that is not canceled', () => {
    expect(statusesAllowedToBecome(undefined)).toEqual([OrderStatus.Pending, OrderStatus.Paid]);
  });

  it('only lets pending orders become paid', () => {
    expect(statusesAllowedToBecome(OrderStatus.Paid)).toEqual([OrderStatus.Pending, OrderStatus.Paid]);
  });

  it('never lets an order go back to pending once paid', () => {
    expect(statusesAllowedToBecome(OrderStatus.Pending)).toEqual([OrderStatus.Pending]);
  });

  it('lets pending and paid orders be canceled', () => {
    expect(statusesAllowedToBecome(OrderStatus.Canceled)).toEqual([OrderStatus.Pending, OrderStatus.Paid]);
  });
});
