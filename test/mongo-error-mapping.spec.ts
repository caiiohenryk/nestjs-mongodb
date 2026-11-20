import mongoose from 'mongoose';
import { resolveError } from '../src/common/filters/http-exception.filter.js';
import { type MongoMemory, startMongoMemory } from './support/mongo-memory.js';

describe('mongo error mapping through mongoose', () => {
  let mongo: MongoMemory;
  let connection: mongoose.Connection;

  beforeAll(async () => {
    mongo = await startMongoMemory('error_mapping');
    connection = await mongoose.createConnection(mongo.uri).asPromise();
  });

  afterAll(async () => {
    await connection.close();
    await mongo.stop();
  });

  it('recognizes duplicate key errors raised by mongoose as conflicts', async () => {
    const model = connection.model('Thing', new mongoose.Schema({ code: { type: String, unique: true } }));
    await model.init();
    await model.create({ code: 'A1' });

    const error: unknown = await model.create({ code: 'A1' }).then(
      () => null,
      (rejection: unknown) => rejection,
    );

    expect(resolveError(error)).toMatchObject({ statusCode: 409, error: 'CONFLICT' });
  });
});
