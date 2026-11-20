import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import type { Mock } from 'vitest';
import { AppConfigService } from '../config/app-config.service.js';
import { OrdersV2Repository } from '../orders-v2/index.js';
import { OrderStatus } from './order-status.js';
import { OrdersQueryService } from './orders-query.service.js';
import { toOrderV2Record } from './orders-v2.mapper.js';
import { OrdersRepository } from './orders.repository.js';
import { buildOrder } from './testing/build-order.js';

type Mocks = {
  readonly v1FindById: Mock<OrdersRepository['findById']>;
  readonly v1FindPage: Mock<OrdersRepository['findPage']>;
  readonly v2FindById: Mock<OrdersV2Repository['findById']>;
  readonly v2FindPage: Mock<OrdersV2Repository['findPage']>;
};

async function createService(readFromV2: boolean): Promise<{ service: OrdersQueryService; mocks: Mocks }> {
  const mocks: Mocks = {
    v1FindById: vi.fn<OrdersRepository['findById']>(),
    v1FindPage: vi.fn<OrdersRepository['findPage']>(),
    v2FindById: vi.fn<OrdersV2Repository['findById']>(),
    v2FindPage: vi.fn<OrdersV2Repository['findPage']>(),
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      OrdersQueryService,
      { provide: OrdersRepository, useValue: { findById: mocks.v1FindById, findPage: mocks.v1FindPage } },
      { provide: OrdersV2Repository, useValue: { findById: mocks.v2FindById, findPage: mocks.v2FindPage } },
      { provide: AppConfigService, useValue: { ordersReadFromV2: readFromV2 } },
    ],
  }).compile();
  return { service: moduleRef.get(OrdersQueryService), mocks };
}

describe('OrdersQueryService', () => {
  describe('reading from orders', () => {
    it('maps the record without exposing _id', async () => {
      const { service, mocks } = await createService(false);
      mocks.v1FindById.mockResolvedValue(buildOrder());

      const order = await service.findById('6740a1b2c3d4e5f6a7b8c9d0');

      expect(order).toMatchObject({ id: '6740a1b2c3d4e5f6a7b8c9d0', totalCents: 10000 });
      expect(order).not.toHaveProperty('_id');
      expect(mocks.v2FindById).not.toHaveBeenCalled();
    });

    it('throws not found when the order does not exist', async () => {
      const { service, mocks } = await createService(false);
      mocks.v1FindById.mockResolvedValue(null);

      await expect(service.findById('6740a1b2c3d4e5f6a7b8c9d0')).rejects.toThrow(NotFoundException);
    });

    it('returns a next cursor only when there are more results', async () => {
      const { service, mocks } = await createService(false);
      mocks.v1FindPage.mockResolvedValue([buildOrder(), buildOrder({ _id: new Types.ObjectId() })]);

      const page = await service.findPage({ limit: 1 });

      expect(page.data).toHaveLength(1);
      expect(page.nextCursor).toEqual(expect.any(String));
    });

    it('returns a null cursor on the last page', async () => {
      const { service, mocks } = await createService(false);
      mocks.v1FindPage.mockResolvedValue([buildOrder()]);

      const page = await service.findPage({ limit: 20 });

      expect(page.nextCursor).toBeNull();
    });
  });

  describe('reading from orders_v2', () => {
    it('returns the same response shape as v1', async () => {
      const { service, mocks } = await createService(true);
      const order = buildOrder({ status: OrderStatus.Paid });
      mocks.v2FindById.mockResolvedValue(toOrderV2Record(order, new Date()));

      const response = await service.findById(order._id.toHexString());

      expect(response).toEqual({
        id: '6740a1b2c3d4e5f6a7b8c9d0',
        customerName: 'Ana',
        customerEmail: 'ana@example.com',
        items: [{ sku: 'A1', name: 'Mouse', quantity: 2, unitPriceCents: 5000 }],
        totalCents: 10000,
        status: 'PAID',
        createdAt: '2026-11-20T10:00:00.000Z',
        updatedAt: '2026-11-20T10:00:00.000Z',
      });
      expect(mocks.v1FindById).not.toHaveBeenCalled();
    });

    it('translates the status filter to the v2 format', async () => {
      const { service, mocks } = await createService(true);
      mocks.v2FindPage.mockResolvedValue([]);

      await service.findPage({ limit: 20, status: OrderStatus.Canceled });

      expect(mocks.v2FindPage).toHaveBeenCalledWith(
        { status: 'canceled', customerEmail: undefined },
        { cursor: null, limit: 20 },
      );
    });
  });
});
