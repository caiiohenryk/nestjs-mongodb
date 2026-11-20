import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const mongodbUri = process.env.MONGODB_URI;

if (!mongodbUri) {
  throw new Error('MONGODB_URI is required to run migrations');
}

export const mongodb = {
  url: mongodbUri,
  options: { writeConcern: { w: 'majority' } },
};
export const migrationsDir = 'migrations';
export const changelogCollectionName = 'changelog';
export const lockCollectionName = 'changelog_lock';
export const lockTtl = 300;
export const migrationFileExtension = '.ts';
export const useFileHash = true;
export const moduleSystem = 'esm';
