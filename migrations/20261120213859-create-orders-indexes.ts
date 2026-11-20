import type { Db, IndexDescription } from 'mongodb';

const COLLECTION = 'orders';

const INDEXES: IndexDescription[] = [
  { key: { createdAt: -1, _id: -1 }, name: 'createdAt_id' },
  { key: { status: 1, createdAt: -1, _id: -1 }, name: 'status_createdAt_id' },
  { key: { customerEmail: 1, createdAt: -1, _id: -1 }, name: 'customerEmail_createdAt_id' },
];

async function collectionExists(db: Db, name: string): Promise<boolean> {
  const collections = await db.listCollections({ name }, { nameOnly: true }).toArray();
  return collections.length > 0;
}

export async function up(db: Db): Promise<void> {
  if (!(await collectionExists(db, COLLECTION))) {
    await db.createCollection(COLLECTION);
  }
  await db.collection(COLLECTION).createIndexes(INDEXES);
}

export async function down(db: Db): Promise<void> {
  if (!(await collectionExists(db, COLLECTION))) {
    return;
  }
  const collection = db.collection(COLLECTION);
  const existing = new Set((await collection.indexes()).map((index) => index.name));
  for (const index of INDEXES) {
    if (index.name !== undefined && existing.has(index.name)) {
      await collection.dropIndex(index.name);
    }
  }
}
