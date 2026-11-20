import { ApiProperty } from '@nestjs/swagger';

export class DailyRevenueDayResponse {
  @ApiProperty({ example: '2026-06-01' })
  readonly day: string;

  @ApiProperty()
  readonly orderCount: number;

  @ApiProperty({ description: 'Revenue in cents' })
  readonly grossCents: number;
}

export class DailyRevenueResponse {
  @ApiProperty({ format: 'date-time' })
  readonly from: string;

  @ApiProperty({ format: 'date-time' })
  readonly to: string;

  @ApiProperty({ type: [DailyRevenueDayResponse] })
  readonly days: readonly DailyRevenueDayResponse[];
}
