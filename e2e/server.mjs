// Starts the built app for the browser tests: empty data folder, fixed test settings, fake
// data sources. Used by playwright.config.ts.
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dataDir = join(tmpdir(), 'hdtracker-e2e');
rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });

Object.assign(process.env, {
	DATA_DIR: dataDir,
	PORT: '4173',
	ORIGIN: 'http://localhost:4173',
	SECRET: 'e2e-secret-e2e-secret-e2e-secret-0123',
	TMDB_API_TOKEN: 'test',
	IGDB_CLIENT_ID: 'test',
	IGDB_CLIENT_SECRET: 'test'
});

await import('./fake-apis.mjs');
await import('../start.js');
