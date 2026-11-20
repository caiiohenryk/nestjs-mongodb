import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Connection } from 'mongoose';
import type { Mock } from 'vitest';
import { OrderStatus } from './order-status.js';
import { OrdersV2Replicator } from './orders-v2.replicator.js';
import { OrdersRepository } from './orders.repository.js';
import { OrdersService } from './orders.service.js';
import { buildOrder } from './testing/build-order.js';

describe('OrdersService', () => {
  let findById: Mock<OrdersRepository['findById']>;
  let transaction: Mock<Connection['transaction']>;
  let service: OrdersService;

  beforeEach(async () => {
    findById = vi.fn<OrdersRepository['findById']>();
    transaction = vi.fn<Connection['transaction']>();
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: OrdersRepository, useValue: { findById } },
        { provide: OrdersV2Replicator, useValue: {} },
        { provide: getConnectionToken(), useValue: { transaction } },
      ],
    }).compile();
    service = moduleRef.get(OrdersService);
  });

  it('throws not found when updating a missing order', async () => {
    findById.mockResolvedValue(null);

    await expect(service.update('6740a1b2c3d4e5f6a7b8c9d0', { customerName: 'Bia' })).rejects.toThrow(
      NotFoundException,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('refuses to change a canceled order without opening a transaction', async () => {
    findById.mockResolvedValue(buildOrder({ status: OrderStatus.Canceled }));

    await expect(service.update('6740a1b2c3d4e5f6a7b8c9d0', { customerName: 'Bia' })).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(transaction).not.toHaveBeenCalled();
  });
});
