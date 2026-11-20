export class DailyRevenueDayResponse {
  readonly day: string;
  readonly orderCount: number;
  readonly grossCents: number;
}

export class DailyRevenueResponse {
  readonly from: string;
  readonly to: string;
  readonly days: readonly DailyRevenueDayResponse[];
}
