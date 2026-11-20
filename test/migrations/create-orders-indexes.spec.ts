import { down, up } from '../../migrations/20261120213859-create-orders-indexes.js';
import { type ConnectedDb, connectDb } from '../support/mongo-client.js';
import { type MongoMemory, startMongoMemory } from '../support/mongo-memory.js';

const ORDER_INDEXES = ['createdAt_id', 'status_createdAt_id', 'customerEmail_createdAt_id'];

describe('migration create-orders-indexes', () => {
  let mongo: MongoMemory;
  let connection: ConnectedDb;

  beforeAll(async () => {
    mongo = await startMongoMemory('migration_orders_indexes');
    connection = await connectDb(mongo.uri);
  });

  afterAll(async () => {
    await connection.close();
    await mongo.stop();
  });

  async function indexNames(): Promise<string[]> {
    const indexes = await connection.db.collection('orders').indexes();
    return indexes.flatMap((index) => (index.name === undefined ? [] : [index.name]));
  }

  it('creates the collection and indexes, and is idempotent', async () => {
    await up(connection.db);
    await up(connection.db);

    expect(await indexNames()).toEqual(expect.arrayContaining(['_id_', ...ORDER_INDEXES]));
  });

  it('removes only its own indexes on down, and tolerates running twice', async () => {
    await down(connection.db);
    await down(connection.db);

    expect(await indexNames()).toEqual(['_id_']);
  });
});
