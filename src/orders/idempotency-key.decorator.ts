import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

export const IdempotencyKey = createParamDecorator((_data: unknown, context: ExecutionContext): string | undefined => {
  const value = context.switchToHttp().getRequest<Request>().headers[IDEMPOTENCY_KEY_HEADER];
  return Array.isArray(value) ? value[0] : value;
});
