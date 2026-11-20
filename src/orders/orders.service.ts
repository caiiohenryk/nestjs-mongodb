import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { MongoServerError } from 'mongodb';
import type { Connection } from 'mongoose';
import { TRANSACTION_OPTIONS } from '../database/transaction-options.js';
import type { CreateOrderDto } from './dto/create-order.dto.js';
import type { OrderResponse } from './dto/order.response.js';
import type { UpdateOrderDto } from './dto/update-order.dto.js';
import { OrderIdempotencyRepository } from './order-idempotency.repository.js';
import { hashCreateOrderRequest } from './order-request-hash.js';
import { OrderStatus } from './order-status.js';
import { statusesAllowedToBecome } from './order-status-transitions.js';
import { calculateTotalCents } from './order-total.js';
import { toOrderResponse } from './orders.mapper.js';
import type { OrderChanges } from './orders.repository.js';
import { OrdersStore } from './orders.store.js';
import type { OrderRecord } from './schemas/order.schema.js';

const DUPLICATE_KEY_ERROR_CODE = 11000;

type IdempotentRequest = {
  readonly key: string;
  readonly requestHash: string;
};

function isDuplicateKey(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === DUPLICATE_KEY_ERROR_CODE;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly store: OrdersStore,
    private readonly idempotency: OrderIdempotencyRepository,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async create(dto: CreateOrderDto, idempotencyKey?: string): Promise<OrderResponse> {
    const request =
      idempotencyKey === undefined ? null : { key: idempotencyKey, requestHash: hashCreateOrderRequest(dto) };
    try {
      return toOrderResponse(await this.createOnce(dto, request));
    } catch (error) {
      if (request === null || !isDuplicateKey(error)) {
        throw error;
      }
      return toOrderResponse(await this.replay(request));
    }
  }

  async update(id: string, dto: UpdateOrderDto): Promise<OrderResponse> {
    const changes: OrderChanges = {
      ...(dto.customerName !== undefined && { customerName: dto.customerName }),
      ...(dto.customerEmail !== undefined && { customerEmail: dto.customerEmail }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.items !== undefined && { items: dto.items, totalCents: calculateTotalCents(dto.items) }),
    };
    const allowedFrom = statusesAllowedToBecome(dto.status);
    const updated = await this.connection.transaction(
      (session) => this.store.updateById(id, { changes, allowedFrom }, session),
      TRANSACTION_OPTIONS,
    );
    if (updated === null) {
      throw await this.explainRejectedUpdate(id, dto.status);
    }
    return toOrderResponse(updated);
  }

  async remove(id: string): Promise<void> {
    await this.connection.transaction(async (session) => {
      const deleted = await this.store.deleteById(id, session);
      if (!deleted) {
        throw this.notFound(id);
      }
    }, TRANSACTION_OPTIONS);
  }

  private createOnce(dto: CreateOrderDto, request: IdempotentRequest | null): Promise<OrderRecord> {
    return this.connection.transaction(async (session) => {
      if (request !== null) {
        const previous = await this.idempotency.findByKey(request.key, session);
        if (previous !== null) {
          return this.resolvePrevious(previous, request);
        }
      }
      const inserted = await this.store.insert(
        {
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          items: dto.items,
          totalCents: calculateTotalCents(dto.items),
          status: OrderStatus.Pending,
        },
        session,
      );
      if (request !== null) {
        await this.idempotency.insert(
          { _id: request.key, requestHash: request.requestHash, orderId: inserted._id },
          session,
        );
      }
      return inserted;
    }, TRANSACTION_OPTIONS);
  }

  private async replay(request: IdempotentRequest): Promise<OrderRecord> {
    const previous = await this.idempotency.findByKey(request.key, null);
    if (previous === null) {
      throw new UnprocessableEntityException('Idempotency-Key is being processed, retry later');
    }
    return this.resolvePrevious(previous, request);
  }

  private async resolvePrevious(
    previous: { readonly requestHash: string; readonly orderId: { toHexString: () => string } },
    request: IdempotentRequest,
  ): Promise<OrderRecord> {
    if (previous.requestHash !== request.requestHash) {
      throw new UnprocessableEntityException('Idempotency-Key was already used with a different request');
    }
    const order = await this.store.findById(previous.orderId.toHexString());
    if (order === null) {
      throw new NotFoundException('The order created with this Idempotency-Key no longer exists');
    }
    return order;
  }

  private async explainRejectedUpdate(
    id: string,
    target: OrderStatus | undefined,
  ): Promise<NotFoundException | UnprocessableEntityException> {
    const current = await this.store.findById(id);
    if (current === null) {
      return this.notFound(id);
    }
    if (target === undefined) {
      return new UnprocessableEntityException(`Orders with status ${current.status} cannot be changed`);
    }
    return new UnprocessableEntityException(`Order cannot change from ${current.status} to ${target}`);
  }

  private notFound(id: string): NotFoundException {
    return new NotFoundException(`Order ${id} not found`);
  }
}
