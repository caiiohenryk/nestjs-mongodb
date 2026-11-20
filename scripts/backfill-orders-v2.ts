import { connectScriptDatabase, readNumberArgument, write } from './support/database.ts';
import { backfillOrdersV2 } from './support/orders-v2-backfill.ts';

async function main(): Promise<void> {
  const batchSize = readNumberArgument('batch-size', 1000);
  if (batchSize > 1000) {
    throw new Error('--batch-size must be at most 1000');
  }
  const database = await connectScriptDatabase();
  try {
    const result = await backfillOrdersV2(database.db, {
      batchSize,
      onProgress: (progress) =>
        write(`processed ${progress.processed} written ${progress.written} skipped ${progress.skippedNewer}`),
    });
    write(`done: processed ${result.processed}, written ${result.written}, skipped newer ${result.skippedNewer}`);
  } finally {
    await database.close();
  }
}

await main();
