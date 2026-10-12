import { eq } from 'drizzle-orm';
import { expect, it, vi } from 'vitest';
import { addItem } from '../../tests/helpers';
import { getDb } from './db';
import { libraryItems } from './db/schema';
import { DETAILS_VERSION, prepareStoredDetails } from './releases';
import { getSetting } from './settings';

const stored = (id: number) =>
	getDb().select().from(libraryItems).where(eq(libraryItems.id, id)).get()!;

it('after an update that stores more about a title, the library is loaded again – once', () => {
	// The data sources are not reachable: the refresh that follows just fails
	vi.mocked(fetch).mockRejectedValue(new Error('offline'));
	const loaded = { metadataUpdatedAt: new Date() };
	const movie = addItem({ externalId: '7', ...loaded });

	prepareStoredDetails();
	expect(stored(movie.id).metadataUpdatedAt).toBeNull();
	expect(getSetting('detailsVersion')).toBe(DETAILS_VERSION);

	// A restart later reloads nothing
	getDb().update(libraryItems).set(loaded).where(eq(libraryItems.id, movie.id)).run();
	prepareStoredDetails();
	expect(stored(movie.id).metadataUpdatedAt).not.toBeNull();
});
