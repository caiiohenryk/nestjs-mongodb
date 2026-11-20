import type { Db, Document } from 'mongodb';

const COLLECTION = 'orders_v2';

const NON_NEGATIVE_INTEGER: Document = { bsonType: ['int', 'long', 'double'], minimum: 0, multipleOf: 1 };

const POSITIVE_INTEGER: Document = { bsonType: ['int', 'long', 'double'], minimum: 1, multipleOf: 1 };

const TIGHT_VALIDATOR: Document = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['customer', 'items', 'totals', 'status', 'schemaVersion', 'createdAt', 'updatedAt', 'syncedAt'],
    properties: {
      customer: {
        bsonType: 'object',
        required: ['name', 'email'],
        properties: {
          name: { bsonType: 'string', minLength: 1, maxLength: 200 },
          email: { bsonType: 'string', minLength: 3, maxLength: 254 },
        },
      },
      items: {
        bsonType: 'array',
        maxItems: 50,
        items: {
          bsonType: 'object',
          required: ['sku', 'name', 'quantity', 'unitPriceCents', 'subtotalCents'],
          properties: {
            sku: { bsonType: 'string', minLength: 1, maxLength: 64 },
            name: { bsonType: 'string', minLength: 1, maxLength: 200 },
            quantity: POSITIVE_INTEGER,
            unitPriceCents: NON_NEGATIVE_INTEGER,
            subtotalCents: NON_NEGATIVE_INTEGER,
          },
        },
      },
      totals: {
        bsonType: 'object',
        required: ['grossCents', 'itemCount'],
        properties: { grossCents: NON_NEGATIVE_INTEGER, itemCount: NON_NEGATIVE_INTEGER },
      },
      status: { enum: ['pending', 'paid', 'canceled'] },
      schemaVersion: { enum: [2] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' },
      syncedAt: { bsonType: 'date' },
    },
  },
};

const PREVIOUS_VALIDATOR: Document = {
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

async function setValidator(db: Db, validator: Document): Promise<void> {
  await db.command({ collMod: COLLECTION, validator, validationLevel: 'strict', validationAction: 'error' });
}

export async function up(db: Db): Promise<void> {
  const violations = await db.collection(COLLECTION).countDocuments({ $nor: [TIGHT_VALIDATOR] });
  if (violations > 0) {
    throw new Error(`${violations} documents in ${COLLECTION} violate the new validator; fix them before tightening`);
  }
  await setValidator(db, TIGHT_VALIDATOR);
}

export async function down(db: Db): Promise<void> {
  await setValidator(db, PREVIOUS_VALIDATOR);
}
