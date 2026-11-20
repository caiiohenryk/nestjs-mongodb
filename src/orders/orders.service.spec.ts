import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import type { Mock } from 'vitest';
import { OrderStatus } from './order-status.js';
import { OrdersRepository } from './orders.repository.js';
import { OrdersService } from './orders.service.js';
import type { OrderRecord } from './schemas/order.schema.js';

function buildOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    _id: new Types.ObjectId('6740a1b2c3d4e5f6a7b8c9d0'),
    customerName: 'Ana',
    customerEmail: 'ana@example.com',
    items: [{ sku: 'A1', name: 'Mouse', quantity: 2, unitPriceCents: 5000 }],
    totalCents: 10000,
    status: OrderStatus.Pending,
    schemaVersion: 1,
    createdAt: new Date('2026-11-20T10:00:00.000Z'),
    updatedAt: new Date('2026-11-20T10:00:00.000Z'),
    ...overrides,
  };
}

type RepositoryMock = {
  [K in 'insert' | 'findById' | 'findPage' | 'updateById' | 'deleteById']: Mock<OrdersRepository[K]>;
};

function createRepositoryMock(): RepositoryMock {
  return {
    insert: vi.fn<OrdersRepository['insert']>(),
    findById: vi.fn<OrdersRepository['findById']>(),
    findPage: vi.fn<OrdersRepository['findPage']>(),
    updateById: vi.fn<OrdersRepository['updateById']>(),
    deleteById: vi.fn<OrdersRepository['deleteById']>(),
  };
}

describe('OrdersService', () => {
  let repository: RepositoryMock;
  let service: OrdersService;

  beforeEach(async () => {
    repository = createRepositoryMock();
    const moduleRef = await Test.createTestingModule({
      providers: [OrdersService, { provide: OrdersRepository, useValue: repository }],
    }).compile();
    service = moduleRef.get(OrdersService);
  });

  it('creates a pending order with the computed total', async () => {
    repository.insert.mockResolvedValue(buildOrder({ totalCents: 13000 }));

    const order = await service.create({
      customerName: 'Ana',
      customerEmail: 'ana@example.com',
      items: [
        { sku: 'A1', name: 'Mouse', quantity: 2, unitPriceCents: 5000 },
        { sku: 'B7', name: 'Pad', quantity: 1, unitPriceCents: 3000 },
      ],
    });

    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({ totalCents: 13000, status: OrderStatus.Pending }),
    );
    expect(order).toMatchObject({ id: '6740a1b2c3d4e5f6a7b8c9d0', totalCents: 13000 });
    expect(order).not.toHaveProperty('_id');
  });

  it('throws not found when the order does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.findById('6740a1b2c3d4e5f6a7b8c9d0')).rejects.toThrow(NotFoundException);
  });

  it('returns a next cursor only when there are more results', async () => {
    repository.findPage.mockResolvedValue([buildOrder(), buildOrder({ _id: new Types.ObjectId() })]);

    const page = await service.findPage({ limit: 1 });

    expect(page.data).toHaveLength(1);
    expect(page.nextCursor).toEqual(expect.any(String));
  });

  it('returns a null cursor on the last page', async () => {
    repository.findPage.mockResolvedValue([buildOrder()]);

    const page = await service.findPage({ limit: 20 });

    expect(page.nextCursor).toBeNull();
  });

  it('recomputes the total when items change', async () => {
    repository.findById.mockResolvedValue(buildOrder());
    repository.updateById.mockResolvedValue(buildOrder({ totalCents: 900 }));

    await service.update('6740a1b2c3d4e5f6a7b8c9d0', {
      items: [{ sku: 'C3', name: 'Cable', quantity: 3, unitPriceCents: 300 }],
    });

    expect(repository.updateById).toHaveBeenCalledWith(
      '6740a1b2c3d4e5f6a7b8c9d0',
      expect.objectContaining({ totalCents: 900 }),
    );
  });

  it('refuses to change a canceled order', async () => {
    repository.findById.mockResolvedValue(buildOrder({ status: OrderStatus.Canceled }));

    await expect(service.update('6740a1b2c3d4e5f6a7b8c9d0', { customerName: 'Bia' })).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(repository.updateById).not.toHaveBeenCalled();
  });

  it('throws not found when deleting a missing order', async () => {
    repository.deleteById.mockResolvedValue(false);

    await expect(service.remove('6740a1b2c3d4e5f6a7b8c9d0')).rejects.toThrow(NotFoundException);
  });
});
