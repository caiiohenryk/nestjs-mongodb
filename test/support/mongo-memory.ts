import { MongoMemoryReplSet } from 'mongodb-memory-server';

export type MongoMemory = {
  readonly uri: string;
  readonly stop: () => Promise<void>;
};

export type MongoMemoryOptions = {
  readonly testCommands?: boolean;
};

export async function startMongoMemory(databaseName = 'test', options: MongoMemoryOptions = {}): Promise<MongoMemory> {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    instanceOpts: options.testCommands === true ? [{ args: ['--setParameter', 'enableTestCommands=1'] }] : [],
  });
  return {
    uri: replSet.getUri(databaseName),
    stop: async (): Promise<void> => {
      await replSet.stop();
    },
  };
}
