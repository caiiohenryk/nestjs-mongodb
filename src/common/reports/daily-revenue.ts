import type { PipelineStage } from 'mongoose';

export type DailyRevenueRange = {
  readonly from: Date;
  readonly to: Date;
};

export type DailyRevenueRow = {
  readonly _id: Date;
  readonly orderCount: number;
  readonly grossCents: number;
};

export function dailyRevenueStages(amountField: string): PipelineStage[] {
  return [
    {
      $group: {
        _id: { $dateTrunc: { date: '$createdAt', unit: 'day', timezone: 'UTC' } },
        orderCount: { $sum: 1 },
        grossCents: { $sum: amountField },
      },
    },
    { $sort: { _id: 1 } },
  ];
}
