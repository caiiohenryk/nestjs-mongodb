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

  get isProduction(): boolean {
    return this.nodeEnv === NodeEnv.Production;
  }
}
