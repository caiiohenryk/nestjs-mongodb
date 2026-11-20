import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import { ReadinessIndicators } from './readiness.indicators.js';
import { ShutdownState } from './shutdown.state.js';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [ShutdownState, ReadinessIndicators],
  exports: [ShutdownState],
})
export class HealthModule {}
