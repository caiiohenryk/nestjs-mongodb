import type { Db, Document } from 'mongodb';

const SOURCE = 'orders';
const TARGET = 'orders_v2';

const TO_ORDER_V2: Document = {
  $project: {
    _id: 1,
    customer: { name: '$customerName', email: '$customerEmail' },
    items: {
      $map: {
        input: { $ifNull: ['$items', []] },
        as: 'item',
        in: {
          sku: '$$item.sku',
          name: '$$item.name',
          quantity: '$$item.quantity',
          unitPriceCents: '$$item.unitPriceCents',
          subtotalCents: { $multiply: ['$$item.quantity', '$$item.unitPriceCents'] },
        },
      },
    },
    totals: {
      grossCents: '$totalCents',
      itemCount: { $sum: { $ifNull: ['$items.quantity', []] } },
    },
    status: { $toLower: '$status' },
    schemaVersion: { $literal: 2 },
    createdAt: 1,
    updatedAt: 1,
    syncedAt: '$$NOW',
  },
};

const KEEP_NEWEST: Document[] = [
  { $replaceWith: { $cond: [{ $gte: ['$updatedAt', '$$new.updatedAt'] }, '$$ROOT', '$$new'] } },
];

export async function up(db: Db): Promise<void> {
  await db
    .collection(SOURCE)
    .aggregate([
      TO_ORDER_V2,
      { $merge: { into: TARGET, on: '_id', whenMatched: KEEP_NEWEST, whenNotMatched: 'insert' } },
    ])
    .toArray();
}

export async function down(db: Db): Promise<void> {
  await db.collection(TARGET).deleteMany({});
}
