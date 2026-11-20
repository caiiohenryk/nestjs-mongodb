import { setTimeout as sleep } from 'node:timers/promises';
import type { ChangeStreamDocument, Db, ResumeToken } from 'mongodb';

const CHECKPOINTS = 'change_stream_checkpoints';
const POLL_INTERVAL_MS = 50;

type Checkpoint = {
  _id: string;
  resumeToken: ResumeToken;
  updatedAt: Date;
};

export type ConsumeOptions = {
  readonly consumer: string;
  readonly maxEvents: number;
  readonly idleTimeoutMs: number;
  readonly onChange?: (change: ChangeStreamDocument) => void;
};

export type ConsumeResult = {
  readonly processed: number;
  readonly byOperation: Readonly<Record<string, number>>;
  readonly resumed: boolean;
};

async function saveCheckpoint(db: Db, consumer: string, resumeToken: ResumeToken): Promise<void> {
  await db
    .collection<Checkpoint>(CHECKPOINTS)
    .updateOne({ _id: consumer }, { $set: { resumeToken, updatedAt: new Date() } }, { upsert: true });
}

export async function consumeOrderChanges(db: Db, options: ConsumeOptions): Promise<ConsumeResult> {
  const checkpoint = await db.collection<Checkpoint>(CHECKPOINTS).findOne({ _id: options.consumer });
  const stream = db.collection('orders').watch([], {
    fullDocument: 'updateLookup',
    ...(checkpoint !== null && { resumeAfter: checkpoint.resumeToken }),
  });
  const byOperation: Record<string, number> = {};
  let processed = 0;
  let idleSince = Date.now();
  try {
    while (processed < options.maxEvents && Date.now() - idleSince < options.idleTimeoutMs) {
      const change = await stream.tryNext();
      if (change === null) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }
      options.onChange?.(change);
      byOperation[change.operationType] = (byOperation[change.operationType] ?? 0) + 1;
      processed += 1;
      idleSince = Date.now();
      await saveCheckpoint(db, options.consumer, stream.resumeToken);
    }
    if (processed === 0) {
      await stream.tryNext();
      await saveCheckpoint(db, options.consumer, stream.resumeToken);
    }
    return { processed, byOperation, resumed: checkpoint !== null };
  } finally {
    await stream.close();
  }
}
