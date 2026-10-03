import { vi } from 'vitest';
import { getDb } from '$lib/server/db';
import { libraryItems } from '$lib/server/db/schema';

type Reply = (url: string, body: string) => unknown;

// Answers requests of the code under test. `replies` maps a part of the address to the JSON
// answer (or a function building it); anything else fails the test. Returns the list of
// requested addresses.
export function mockFetch(replies: Record<string, unknown | Reply>) {
	const calls: string[] = [];
	vi.mocked(fetch).mockImplementation(async (input, init) => {
		const url = String(input);
		const key = Object.keys(replies).find((k) => url.includes(k));
		if (!key) throw new Error(`Unexpected request in a test: ${url}`);
		calls.push(url);
		const reply = replies[key];
		const data =
			typeof reply === 'function' ? (reply as Reply)(url, String(init?.body ?? '')) : reply;
		return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
	});
	return calls;
}

// Adds a title to the library, with sensible defaults.
export function addItem(values: Partial<typeof libraryItems.$inferInsert> = {}) {
	return getDb()
		.insert(libraryItems)
		.values({
			category: 'movies',
			source: 'tmdb',
			externalId: '1',
			title: 'Test',
			status: 'planned',
			...values
		})
		.returning()
		.get();
}
