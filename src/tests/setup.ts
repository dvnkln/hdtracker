// Runs before every test file: an empty database in a temporary folder and no network.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, vi } from 'vitest';

const dir = mkdtempSync(join(tmpdir(), 'hdtracker-test-'));
process.env.DATA_DIR = dir;
process.env.SECRET = 'test-secret-test-secret-test-secret-0123';
process.env.TMDB_API_TOKEN = 'test';
process.env.IGDB_CLIENT_ID = 'test';
process.env.IGDB_CLIENT_SECRET = 'test';

// Tests never ask a real API: a test that needs an answer provides it with mockFetch().
beforeEach(() => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: unknown) => {
			throw new Error(`Unexpected request in a test: ${String(url)}`);
		})
	);
});

// Imported only now, so the modules see the settings above.
const { getDb, runMigrations } = await import('$lib/server/db');
runMigrations();

afterAll(() => {
	getDb().$client.close();
	rmSync(dir, { recursive: true, force: true });
});
