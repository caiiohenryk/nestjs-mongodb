import { type AnyBulkWriteOperation, type Db, type Document, MongoBulkWriteError, type ObjectId } from 'mongodb';

const DUPLICATE_KEY_ERROR_CODE = 11000;

export type OrderV1 = {
  readonly _id: ObjectId;
  readonly customerName: string;
  readonly customerEmail: string;
  readonly items?: readonly {
    readonly sku: string;
    readonly name: string;
    readonly quantity: number;
    readonly unitPriceCents: number;
  }[];
  readonly totalCents: number;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type BackfillOptions = {
  readonly batchSize: number;
  readonly onProgress?: (progress: BackfillProgress) => void;
};

export type BackfillProgress = {
  readonly processed: number;
  readonly written: number;
  readonly skippedNewer: number;
  readonly lastId: ObjectId | null;
};

const CHECKPOINTS = 'migration_checkpoints';
const CHECKPOINT_ID = 'backfill-orders-v2';

export function toOrderV2(order: OrderV1, syncedAt: Date): Document {
  const items = (order.items ?? []).map((item) => ({
    sku: item.sku,
    name: item.name,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    subtotalCents: item.quantity * item.unitPriceCents,
  }));
  return {
    _id: order._id,
    customer: { name: order.customerName, email: order.customerEmail },
    items,
    totals: {
      grossCents: order.totalCents,
      itemCount: items.reduce((count, item) => count + item.quantity, 0),
    },
    status: order.status.toLowerCase(),
    schemaVersion: 2,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    syncedAt,
  };
}

function toReplaceIfOlder(order: OrderV1, syncedAt: Date): AnyBulkWriteOperation {
  return {
    replaceOne: {
      filter: { _id: order._id, updatedAt: { $lt: order.updatedAt } },
      replacement: toOrderV2(order, syncedAt),
      upsert: true,
    },
  };
}

async function writeBatch(db: Db, operations: AnyBulkWriteOperation[]): Promise<{ written: number; skipped: number }> {
  try {
    const result = await db.collection('orders_v2').bulkWrite(operations, { ordered: false });
    return { written: result.upsertedCount + result.modifiedCount, skipped: 0 };
  } catch (error) {
    if (!(error instanceof MongoBulkWriteError)) {
      throw error;
    }
    const writeErrors = [error.writeErrors].flat();
    const unexpected = writeErrors.filter((writeError) => writeError.code !== DUPLICATE_KEY_ERROR_CODE);
    if (unexpected.length > 0) {
      throw error;
    }
    return {
      written: error.result.upsertedCount + error.result.modifiedCount,
      skipped: writeErrors.length,
    };
  }
}

async function readCheckpoint(db: Db): Promise<ObjectId | null> {
  const checkpoint = await db
    .collection<{ _id: string; lastId: ObjectId }>(CHECKPOINTS)
    .findOne({ _id: CHECKPOINT_ID });
  return checkpoint?.lastId ?? null;
}

async function saveCheckpoint(db: Db, lastId: ObjectId): Promise<void> {
  await db
    .collection<{ _id: string; lastId: ObjectId; updatedAt: Date }>(CHECKPOINTS)
    .updateOne({ _id: CHECKPOINT_ID }, { $set: { lastId, updatedAt: new Date() } }, { upsert: true });
}

export async function clearCheckpoint(db: Db): Promise<void> {
  await db.collection<{ _id: string }>(CHECKPOINTS).deleteOne({ _id: CHECKPOINT_ID });
}

export async function backfillOrdersV2(db: Db, options: BackfillOptions): Promise<BackfillProgress> {
  const orders = db.collection<OrderV1>('orders');
  let progress: BackfillProgress = { processed: 0, written: 0, skippedNewer: 0, lastId: await readCheckpoint(db) };
  for (;;) {
    const filter = progress.lastId === null ? {} : { _id: { $gt: progress.lastId } };
    const batch = await orders.find(filter).sort({ _id: 1 }).limit(options.batchSize).toArray();
    const last = batch.at(-1);
    if (last === undefined) {
      await clearCheckpoint(db);
      return progress;
    }
    const syncedAt = new Date();
    const result = await writeBatch(
      db,
      batch.map((order) => toReplaceIfOlder(order, syncedAt)),
    );
    await saveCheckpoint(db, last._id);
    progress = {
      processed: progress.processed + batch.length,
      written: progress.written + result.written,
      skippedNewer: progress.skippedNewer + result.skipped,
      lastId: last._id,
    };
    options.onProgress?.(progress);
  }
}
