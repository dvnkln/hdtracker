import { mkdirSync } from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import { DATA_DIR, DB_PATH, MIGRATIONS_DIR } from '../config';

let instance: BetterSQLite3Database<typeof schema> | undefined;

// Opens the database on first use (not at import time, so `vite build` never touches it).
export function getDb() {
	if (!instance) {
		mkdirSync(DATA_DIR, { recursive: true });
		const client = new Database(DB_PATH);
		client.pragma('journal_mode = WAL');
		client.pragma('foreign_keys = ON');
		instance = drizzle(client, { schema });
	}
	return instance;
}

// Applies all pending migrations from the drizzle/ folder. Called once at server start.
export function runMigrations() {
	migrate(getDb(), { migrationsFolder: MIGRATIONS_DIR });
}
