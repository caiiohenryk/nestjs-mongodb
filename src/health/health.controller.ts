import { Controller, Get } from '@nestjs/common';
import { HealthCheck, type HealthCheckResult, HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';
import { ReadinessIndicators } from './readiness.indicators.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
    private readonly readiness: ReadinessIndicators,
  ) {}

  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.ready();
  }

  @Get('live')
  @HealthCheck()
  live(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.readiness.acceptingTraffic('shutdown'),
      () => this.mongoose.pingCheck('mongodb'),
      () => this.readiness.writablePrimary('mongodbPrimary'),
    ]);
  }
}
