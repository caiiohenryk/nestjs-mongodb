import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const RequestHeader = createParamDecorator((name: string, context: ExecutionContext): string | undefined => {
  const value = context.switchToHttp().getRequest<Request>().headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
});
