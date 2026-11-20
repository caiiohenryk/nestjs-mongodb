import { MongoMemoryReplSet } from 'mongodb-memory-server';

export type MongoMemory = {
  readonly uri: string;
  readonly stop: () => Promise<void>;
};

export async function startMongoMemory(databaseName = 'test'): Promise<MongoMemory> {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  return {
    uri: replSet.getUri(databaseName),
    stop: async (): Promise<void> => {
      await replSet.stop();
    },
  };
}
