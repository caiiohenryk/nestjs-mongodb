import { consumeOrderChanges } from '../scripts/support/orders-change-stream.ts';
import { type ConnectedDb, connectDb } from './support/mongo-client.js';
import { type MongoMemory, startMongoMemory } from './support/mongo-memory.js';

const consumer = { consumer: 'test-consumer', maxEvents: 100, idleTimeoutMs: 500 };

describe('orders change stream consumer', () => {
  let mongo: MongoMemory;
  let connection: ConnectedDb;

  beforeAll(async () => {
    mongo = await startMongoMemory('change_stream');
    connection = await connectDb(mongo.uri);
    await connection.db.createCollection('orders');
  });

  afterAll(async () => {
    await connection.close();
    await mongo.stop();
  });

  it('starts from now, then resumes from the saved token without losing or repeating events', async () => {
    const orders = connection.db.collection('orders');
    const first = await consumeOrderChanges(connection.db, consumer);

    const { insertedIds } = await orders.insertMany([{ customerName: 'Ana' }, { customerName: 'Bia' }]);
    await orders.updateOne({ _id: insertedIds[0] }, { $set: { status: 'PAID' } });
    const second = await consumeOrderChanges(connection.db, consumer);

    await orders.deleteOne({ _id: insertedIds[1] });
    const third = await consumeOrderChanges(connection.db, consumer);

    expect(first).toEqual({ processed: 0, byOperation: {}, resumed: false });
    expect(second).toEqual({ processed: 3, byOperation: { insert: 2, update: 1 }, resumed: true });
    expect(third).toEqual({ processed: 1, byOperation: { delete: 1 }, resumed: true });
  });

  it('delivers the full document on updates', async () => {
    const orders = connection.db.collection('orders');
    const { insertedId } = await orders.insertOne({ customerName: 'Caio', status: 'PENDING' });
    await consumeOrderChanges(connection.db, consumer);
    const received: unknown[] = [];

    await orders.updateOne({ _id: insertedId }, { $set: { status: 'PAID' } });
    await consumeOrderChanges(connection.db, {
      ...consumer,
      onChange: (change) => received.push('fullDocument' in change ? change.fullDocument : null),
    });

    expect(received).toEqual([expect.objectContaining({ customerName: 'Caio', status: 'PAID' })]);
  });
});
