import { type Db, MongoClient } from 'mongodb';

export type ConnectedDb = {
  readonly db: Db;
  readonly close: () => Promise<void>;
};

export async function connectDb(uri: string): Promise<ConnectedDb> {
  const client = await MongoClient.connect(uri);
  return {
    db: client.db(),
    close: async (): Promise<void> => {
      await client.close();
    },
  };
}
