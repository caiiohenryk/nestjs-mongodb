import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { type Observable, tap } from 'rxjs';
import type { OrderResponse } from './dto/order.response.js';
import { toOrderEtag } from './order-version.js';

@Injectable()
export class OrderEtagInterceptor implements NestInterceptor<OrderResponse, OrderResponse> {
  intercept(context: ExecutionContext, next: CallHandler<OrderResponse>): Observable<OrderResponse> {
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(tap((order) => response.setHeader('ETag', toOrderEtag(order.updatedAt))));
  }
}
