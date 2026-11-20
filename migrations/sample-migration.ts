import type { Db, MongoClient } from 'mongodb';

export async function up(db: Db, client: MongoClient): Promise<void> {
  throw new Error(
    `Migration up not implemented for ${db.databaseName} via ${client.options.appName ?? 'migrate-mongo'}`,
  );
}

export async function down(db: Db, client: MongoClient): Promise<void> {
  throw new Error(
    `Migration down not implemented for ${db.databaseName} via ${client.options.appName ?? 'migrate-mongo'}`,
  );
}
