import { vi } from 'vitest';
import { getDb } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import type { Category, Status } from '$lib/status';
import { libraryItems, trackingMembers, trackings, users } from '$lib/server/db/schema';
import { findItem, SOURCE_FOR } from '$lib/server/library';

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

// The account the tests work with, unless they name another one: the first one there is,
// created if there is none yet.
export function testUser() {
	const db = getDb();
	const first = db.select({ id: users.id }).from(users).orderBy(users.id).limit(1).get();
	return (
		first?.id ??
		db.insert(users).values({ username: 'tester', passwordHash: 'x' }).returning().get().id
	);
}

type ItemValues = Partial<typeof libraryItems.$inferInsert> & {
	status?: Status;
	notify?: boolean;
	// Whose library (default: the test account)
	userId?: number;
};

// Adds a title to somebody's library, with sensible defaults. Returns it as the library
// functions do: the title with that user's state.
export function addItem({ status = 'planned', notify = true, userId, ...values }: ItemValues = {}) {
	const db = getDb();
	const owner = userId ?? testUser();
	const category = values.category ?? 'movies';
	// (The source follows the area, as everywhere in the app.)
	const title = {
		source: SOURCE_FOR[category],
		externalId: '1',
		title: 'Test',
		...values,
		category
	};
	db.insert(libraryItems)
		.values(title as typeof libraryItems.$inferInsert)
		.onConflictDoNothing()
		.run();
	const stored = db
		.select()
		.from(libraryItems)
		.where(and(eq(libraryItems.category, category), eq(libraryItems.externalId, title.externalId)))
		.get()!;
	const tracking = db.insert(trackings).values({ itemId: stored.id, status }).returning().get();
	db.insert(trackingMembers)
		.values({ trackingId: tracking.id, userId: owner, itemId: stored.id, notify })
		.run();
	return findItem(owner, stored.category, stored.externalId)!;
}
