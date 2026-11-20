import type { AnyBulkWriteOperation, Document } from 'mongodb';
import { connectScriptDatabase, readNumberArgument, write } from './support/database.ts';

const BATCH_SIZE = 1000;
const CUSTOMER_POOL = 5000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const STATUSES = ['PENDING', 'PAID', 'PAID', 'PAID', 'CANCELED'];
const PRODUCTS = [
  { sku: 'KB-01', name: 'Keyboard', unitPriceCents: 25990 },
  { sku: 'MS-02', name: 'Mouse', unitPriceCents: 8990 },
  { sku: 'MN-03', name: 'Monitor', unitPriceCents: 129900 },
  { sku: 'HS-04', name: 'Headset', unitPriceCents: 34990 },
  { sku: 'CB-05', name: 'USB-C Cable', unitPriceCents: 3990 },
  { sku: 'WC-06', name: 'Webcam', unitPriceCents: 45990 },
];

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function pick<T>(values: readonly T[]): T {
  const value = values[randomInt(values.length)];
  if (value === undefined) {
    throw new Error('Cannot pick from an empty list');
  }
  return value;
}

function buildOrder(now: number): Document {
  const customer = randomInt(CUSTOMER_POOL);
  const items = Array.from({ length: 1 + randomInt(4) }, () => ({ ...pick(PRODUCTS), quantity: 1 + randomInt(3) }));
  const createdAt = new Date(now - randomInt(365 * DAY_IN_MS));
  return {
    customerName: `Customer ${customer}`,
    customerEmail: `customer${customer}@example.com`,
    items,
    totalCents: items.reduce((total, item) => total + item.quantity * item.unitPriceCents, 0),
    status: pick(STATUSES),
    schemaVersion: 1,
    createdAt,
    updatedAt: createdAt,
  };
}

async function seed(): Promise<void> {
  const count = readNumberArgument('count', 100_000);
  const database = await connectScriptDatabase();
  const orders = database.db.collection('orders');
  const now = Date.now();
  try {
    for (let inserted = 0; inserted < count; inserted += BATCH_SIZE) {
      const size = Math.min(BATCH_SIZE, count - inserted);
      const operations: AnyBulkWriteOperation[] = Array.from({ length: size }, () => ({
        insertOne: { document: buildOrder(now) },
      }));
      await orders.bulkWrite(operations, { ordered: false });
      write(`inserted ${inserted + size}/${count}`);
    }
    write(`orders collection now has ${await orders.estimatedDocumentCount()} documents`);
  } finally {
    await database.close();
  }
}

await seed();
