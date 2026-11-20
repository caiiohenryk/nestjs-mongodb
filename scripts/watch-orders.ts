import { connectScriptDatabase, write } from './support/database.ts';
import { consumeOrderChanges } from './support/orders-change-stream.ts';

async function main(): Promise<void> {
  const database = await connectScriptDatabase();
  const stop = new AbortController();
  process.once('SIGINT', () => stop.abort());
  try {
    while (!stop.signal.aborted) {
      await consumeOrderChanges(database.db, {
        consumer: 'watch-orders-cli',
        maxEvents: 100,
        idleTimeoutMs: 1000,
        onChange: (change) => {
          const id = 'documentKey' in change ? String(change.documentKey._id) : '-';
          write(`${new Date().toISOString()} ${change.operationType} ${id}`);
        },
      });
    }
  } finally {
    await database.close();
  }
}

await main();
