import { existsSync } from 'node:fs';
import { type Db, MongoClient } from 'mongodb';

export type ScriptDatabase = {
  readonly db: Db;
  readonly close: () => Promise<void>;
};

export function readMongodbUri(): string {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }
  return uri;
}

export async function connectScriptDatabase(): Promise<ScriptDatabase> {
  const client = await MongoClient.connect(readMongodbUri());
  return {
    db: client.db(),
    close: async (): Promise<void> => {
      await client.close();
    },
  };
}

export function readNumberArgument(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  if (raw === undefined) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return value;
}

export function write(line: string): void {
  process.stdout.write(`${line}\n`);
}
