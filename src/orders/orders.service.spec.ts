import { NotFoundException, PreconditionFailedException, UnprocessableEntityException } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Connection } from 'mongoose';
import type { Mock } from 'vitest';
import { OrderStatus } from './order-status.js';
import { OrderIdempotencyRepository } from './order-idempotency.repository.js';
import { OrdersService } from './orders.service.js';
import { OrdersStore } from './orders.store.js';
import { buildOrder } from './testing/build-order.js';

const id = '6740a1b2c3d4e5f6a7b8c9d0';

describe('OrdersService', () => {
  let findById: Mock<OrdersStore['findById']>;
  let transaction: Mock<Connection['transaction']>;
  let service: OrdersService;

  beforeEach(async () => {
    findById = vi.fn<OrdersStore['findById']>();
    transaction = vi.fn<Connection['transaction']>();
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: OrdersStore, useValue: { findById } },
        { provide: OrderIdempotencyRepository, useValue: {} },
        { provide: getConnectionToken(), useValue: { transaction } },
      ],
    }).compile();
    service = moduleRef.get(OrdersService);
  });

  it('throws not found when the conditional update matched nothing and the order does not exist', async () => {
    transaction.mockResolvedValue(null);
    findById.mockResolvedValue(null);

    await expect(service.update({ id, dto: { customerName: 'Bia' } })).rejects.toThrow(NotFoundException);
  });

  it('throws unprocessable when a canceled order is changed', async () => {
    transaction.mockResolvedValue(null);
    findById.mockResolvedValue(buildOrder({ status: OrderStatus.Canceled }));

    await expect(service.update({ id, dto: { customerName: 'Bia' } })).rejects.toThrow(
      new UnprocessableEntityException('Orders with status CANCELED cannot be changed'),
    );
  });

  it('throws unprocessable when a paid order goes back to pending', async () => {
    transaction.mockResolvedValue(null);
    findById.mockResolvedValue(buildOrder({ status: OrderStatus.Paid }));

    await expect(service.update({ id, dto: { status: OrderStatus.Pending } })).rejects.toThrow(
      new UnprocessableEntityException('Order cannot change from PAID to PENDING'),
    );
  });

  it('throws precondition failed when the order changed since the given version', async () => {
    transaction.mockResolvedValue(null);
    findById.mockResolvedValue(buildOrder({ updatedAt: new Date('2026-11-21T00:00:00.000Z') }));

    await expect(
      service.update({ id, dto: { customerName: 'Bia' }, expectedUpdatedAt: new Date('2026-11-20T10:00:00.000Z') }),
    ).rejects.toThrow(PreconditionFailedException);
  });
});
