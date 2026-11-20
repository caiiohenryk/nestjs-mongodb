import type { Db } from 'mongodb';

const COLLECTION = 'order_idempotency_keys';
const TTL_SECONDS = 24 * 60 * 60;

async function collectionExists(db: Db, name: string): Promise<boolean> {
  const collections = await db.listCollections({ name }, { nameOnly: true }).toArray();
  return collections.length > 0;
}

export async function up(db: Db): Promise<void> {
  if (!(await collectionExists(db, COLLECTION))) {
    await db.createCollection(COLLECTION);
  }
  await db
    .collection(COLLECTION)
    .createIndex({ createdAt: 1 }, { name: 'createdAt_ttl', expireAfterSeconds: TTL_SECONDS });
}

export async function down(db: Db): Promise<void> {
  if (await collectionExists(db, COLLECTION)) {
    await db.collection(COLLECTION).drop();
  }
}
