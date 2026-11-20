import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env, NodeEnv } from './env.schema.js';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService<Env, true>) {}

  get nodeEnv(): Env['NODE_ENV'] {
    return this.configService.get('NODE_ENV', { infer: true });
  }

  get port(): number {
    return this.configService.get('PORT', { infer: true });
  }

  get mongodbUri(): string {
    return this.configService.get('MONGODB_URI', { infer: true });
  }

  get queryMaxTimeMs(): number {
    return this.configService.get('QUERY_MAX_TIME_MS', { infer: true });
  }

  get ordersDualWrite(): boolean {
    return this.configService.get('ORDERS_DUAL_WRITE', { infer: true });
  }

  get ordersReadFromV2(): boolean {
    return this.configService.get('ORDERS_READ_FROM_V2', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === NodeEnv.Production;
  }
}
