import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import type { Connection } from 'mongoose';
import { z } from 'zod';
import { ShutdownState } from './shutdown.state.js';

const helloSchema = z.object({ isWritablePrimary: z.boolean() });

@Injectable()
export class ReadinessIndicators {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly health: HealthIndicatorService,
    private readonly shutdown: ShutdownState,
  ) {}

  async writablePrimary(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.health.check(key);
    const db = this.connection.db;
    if (db === undefined) {
      return indicator.down('not connected');
    }
    try {
      const hello = helloSchema.safeParse(await db.admin().command({ hello: 1 }));
      if (!hello.success || !hello.data.isWritablePrimary) {
        return indicator.down('node is not a writable primary');
      }
      return indicator.up();
    } catch {
      return indicator.down('hello command failed');
    }
  }

  acceptingTraffic(key: string): HealthIndicatorResult {
    const indicator = this.health.check(key);
    return this.shutdown.isShuttingDown ? indicator.down('application is shutting down') : indicator.up();
  }
}
