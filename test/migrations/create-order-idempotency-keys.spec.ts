import { down, up } from '../../migrations/20261120223143-create-order-idempotency-keys.js';
import { type ConnectedDb, connectDb } from '../support/mongo-client.js';
import { type MongoMemory, startMongoMemory } from '../support/mongo-memory.js';

describe('migration create-order-idempotency-keys', () => {
  let mongo: MongoMemory;
  let connection: ConnectedDb;

  beforeAll(async () => {
    mongo = await startMongoMemory('migration_idempotency_keys');
    connection = await connectDb(mongo.uri);
  });

  afterAll(async () => {
    await connection.close();
    await mongo.stop();
  });

  it('creates a ttl index that expires keys after 24 hours, idempotently', async () => {
    await up(connection.db);
    await up(connection.db);

    const indexes = await connection.db.collection('order_idempotency_keys').indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'createdAt_ttl', expireAfterSeconds: 86400 })]),
    );
  });

  it('drops the collection on down, and tolerates running twice', async () => {
    await down(connection.db);
    await down(connection.db);

    const collections = await connection.db.listCollections({ name: 'order_idempotency_keys' }).toArray();
    expect(collections).toHaveLength(0);
  });
});
