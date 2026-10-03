import { zstdCompressSync } from 'node:zlib';
import { eq } from 'drizzle-orm';
import { expect, it, vi } from 'vitest';
import { addItem } from '../../tests/helpers';
import { MAPPING_URL, mappingFor } from './animeMapping';
import { getDb } from './db';
import { libraryItems } from './db/schema';
import { prepareAnimeTitles } from './releases';
import { getSetting } from './settings';

const LIST = { 'anilist:301': { 'tmdb_show:202:s1': { '1-12': '1-12' } } };
// GitHub answers with the list; the data sources are not reachable (their refresh just fails).
const answer = () =>
	vi.mocked(fetch).mockImplementation(async (url) => {
		if (String(url) === MAPPING_URL) return new Response(zstdCompressSync(JSON.stringify(LIST)));
		throw new Error('offline');
	});
const downloads = () =>
	vi.mocked(fetch).mock.calls.filter(([url]) => String(url) === MAPPING_URL).length;
const stored = (id: number) =>
	getDb().select().from(libraryItems).where(eq(libraryItems.id, id)).get()!;

it('after an update, anime in the library are loaded again once the list is there', async () => {
	answer();
	// Nothing to do without anime: the list comes with the first one
	await prepareAnimeTitles();
	expect(fetch).not.toHaveBeenCalled();

	const loaded = { metadataUpdatedAt: new Date() };
	const anime = addItem({ category: 'anime', source: 'anilist', externalId: '301', ...loaded });
	const movie = addItem({ externalId: '7', ...loaded });
	await prepareAnimeTitles();
	expect(downloads()).toBe(1);
	expect(mappingFor('301')).toHaveLength(1);
	expect(stored(anime.id).metadataUpdatedAt).toBeNull();
	expect(stored(movie.id).metadataUpdatedAt).not.toBeNull();

	// Only the first time: with a list in place, a restart reloads nothing
	getDb().update(libraryItems).set(loaded).where(eq(libraryItems.id, anime.id)).run();
	await prepareAnimeTitles();
	expect(downloads()).toBe(1);
	expect(stored(anime.id).metadataUpdatedAt).not.toBeNull();
	expect(getSetting('animeMappingAt')).not.toBe('');
});
