import type { Db, Document, IndexDescription } from 'mongodb';

const COLLECTION = 'orders_v2';

const INDEXES: IndexDescription[] = [
  { key: { createdAt: -1, _id: -1 }, name: 'createdAt_id' },
  { key: { status: 1, createdAt: -1, _id: -1 }, name: 'status_createdAt_id' },
  { key: { 'customer.email': 1, createdAt: -1, _id: -1 }, name: 'customerEmail_createdAt_id' },
];

const VALIDATOR: Document = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['customer', 'items', 'totals', 'status', 'schemaVersion', 'createdAt', 'updatedAt'],
    properties: {
      customer: {
        bsonType: 'object',
        required: ['name', 'email'],
        properties: { name: { bsonType: 'string' }, email: { bsonType: 'string' } },
      },
      items: {
        bsonType: 'array',
        maxItems: 50,
        items: {
          bsonType: 'object',
          required: ['sku', 'name', 'quantity', 'unitPriceCents', 'subtotalCents'],
        },
      },
      totals: {
        bsonType: 'object',
        required: ['grossCents', 'itemCount'],
        properties: {
          grossCents: { bsonType: ['int', 'long', 'double'], minimum: 0, multipleOf: 1 },
          itemCount: { bsonType: ['int', 'long', 'double'], minimum: 0, multipleOf: 1 },
        },
      },
      status: { enum: ['pending', 'paid', 'canceled'] },
      schemaVersion: { enum: [2] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' },
    },
  },
};

async function collectionExists(db: Db, name: string): Promise<boolean> {
  const collections = await db.listCollections({ name }, { nameOnly: true }).toArray();
  return collections.length > 0;
}

export async function up(db: Db): Promise<void> {
  if (await collectionExists(db, COLLECTION)) {
    await db.command({
      collMod: COLLECTION,
      validator: VALIDATOR,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  } else {
    await db.createCollection(COLLECTION, {
      validator: VALIDATOR,
      validationLevel: 'strict',
      validationAction: 'error',
    });
  }
  await db.collection(COLLECTION).createIndexes(INDEXES);
}

export async function down(db: Db): Promise<void> {
  if (await collectionExists(db, COLLECTION)) {
    await db.collection(COLLECTION).drop();
  }
}
