import type { Db, Document } from 'mongodb';
import { connectScriptDatabase, write } from './support/database.ts';

type Totals = {
  readonly count: number;
  readonly grossCents: number;
  readonly byStatus: Record<string, number>;
};

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

type SummarySource = {
  readonly collection: string;
  readonly amountField: string;
  readonly statusExpression: Document | string;
};

async function summarize(db: Db, { collection, amountField, statusExpression }: SummarySource): Promise<Totals> {
  const rows = await db
    .collection(collection)
    .aggregate([{ $group: { _id: statusExpression, count: { $sum: 1 }, grossCents: { $sum: amountField } } }])
    .toArray();
  return rows.reduce<Totals>(
    (totals, row) => ({
      count: totals.count + toNumber(row.count),
      grossCents: totals.grossCents + toNumber(row.grossCents),
      byStatus: { ...totals.byStatus, [String(row._id)]: toNumber(row.count) },
    }),
    { count: 0, grossCents: 0, byStatus: {} },
  );
}

async function findMissingIds(db: Db, limit: number): Promise<string[]> {
  const rows = await db
    .collection('orders')
    .aggregate([
      {
        $lookup: {
          from: 'orders_v2',
          localField: '_id',
          foreignField: '_id',
          as: 'v2',
          pipeline: [{ $project: { _id: 1 } }],
        },
      },
      { $match: { v2: { $size: 0 } } },
      { $limit: limit },
      { $project: { _id: 1 } },
    ])
    .toArray();
  return rows.map((row) => String(row._id));
}

function sameStatusCounts(left: Record<string, number>, right: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => left[key] === right[key]);
}

async function main(): Promise<void> {
  const database = await connectScriptDatabase();
  try {
    const v1 = await summarize(database.db, {
      collection: 'orders',
      amountField: '$totalCents',
      statusExpression: { $toLower: '$status' },
    });
    const v2 = await summarize(database.db, {
      collection: 'orders_v2',
      amountField: '$totals.grossCents',
      statusExpression: '$status',
    });
    const missing = await findMissingIds(database.db, 10);
    const checks = [
      { name: 'document count', ok: v1.count === v2.count, detail: `${v1.count} vs ${v2.count}` },
      { name: 'gross amount', ok: v1.grossCents === v2.grossCents, detail: `${v1.grossCents} vs ${v2.grossCents}` },
      {
        name: 'count by status',
        ok: sameStatusCounts(v1.byStatus, v2.byStatus),
        detail: `${JSON.stringify(v1.byStatus)} vs ${JSON.stringify(v2.byStatus)}`,
      },
      { name: 'orders missing in v2', ok: missing.length === 0, detail: missing.join(', ') || 'none' },
    ];
    for (const check of checks) {
      write(`${check.ok ? 'OK  ' : 'FAIL'} ${check.name}: ${check.detail}`);
    }
    if (checks.some((check) => !check.ok)) {
      process.exitCode = 1;
    }
  } finally {
    await database.close();
  }
}

await main();
