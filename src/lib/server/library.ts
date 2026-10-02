import { and, count, eq, inArray } from 'drizzle-orm';
import type { Category, Status } from '$lib/status';
import { getDb } from './db';
import { libraryItems } from './db/schema';
import { getSetting } from './settings';
import type { SearchResult } from './providers/types';

export type LibraryItem = typeof libraryItems.$inferSelect;

// Which API each area uses.
export const SOURCE_FOR: Record<Category, SearchResult['source']> = {
	movies: 'tmdb',
	series: 'tmdb',
	anime: 'anilist',
	games: 'igdb'
};

// All items of a category, sorted A–Z (German rules, so "Ä" sorts like "A").
// Anime are sorted by the title shown on top (English or Romaji, see settings).
export function listLibrary(category: Category) {
	const items = getDb()
		.select()
		.from(libraryItems)
		.where(eq(libraryItems.category, category))
		.all();
	const romaji = category === 'anime' && getSetting('animeTitle') === 'romaji';
	const sortTitle = (i: LibraryItem) => (romaji && i.originalTitle) || i.title;
	return items.sort((a, b) =>
		sortTitle(a).localeCompare(sortTitle(b), 'de', { sensitivity: 'base' })
	);
}

// Status of the given search hits that are already in the library (externalId -> status).
export function libraryStatusFor(category: Category, externalIds: string[]) {
	if (externalIds.length === 0) return new Map<string, Status>();
	const rows = getDb()
		.select({ externalId: libraryItems.externalId, status: libraryItems.status })
		.from(libraryItems)
		.where(
			and(
				eq(libraryItems.category, category),
				eq(libraryItems.source, SOURCE_FOR[category]),
				inArray(libraryItems.externalId, externalIds)
			)
		)
		.all();
	return new Map(rows.map((r) => [r.externalId, r.status]));
}

// Adds an item, or only changes its status if it is already in the library.
export function saveItem(category: Category, item: SearchResult, status: Status) {
	const now = new Date();
	getDb()
		.insert(libraryItems)
		.values({ ...item, category, status, addedAt: now, statusChangedAt: now })
		.onConflictDoUpdate({
			target: [libraryItems.category, libraryItems.source, libraryItems.externalId],
			set: { status, statusChangedAt: now }
		})
		.run();
}

export function removeItem(category: Category, externalId: string) {
	getDb()
		.delete(libraryItems)
		.where(
			and(
				eq(libraryItems.category, category),
				eq(libraryItems.source, SOURCE_FOR[category]),
				eq(libraryItems.externalId, externalId)
			)
		)
		.run();
}

// Deletes all items of one category (or of all categories), including watched episodes.
// Returns how many items were deleted.
export function clearLibrary(category: Category | 'all') {
	const query = getDb().delete(libraryItems);
	return (category === 'all' ? query : query.where(eq(libraryItems.category, category))).run()
		.changes;
}

// The library entry for a title, if it is in the library.
export function findItem(category: Category, externalId: string): LibraryItem | undefined {
	return getDb()
		.select()
		.from(libraryItems)
		.where(
			and(
				eq(libraryItems.category, category),
				eq(libraryItems.source, SOURCE_FOR[category]),
				eq(libraryItems.externalId, externalId)
			)
		)
		.get();
}

// ---- Validation of item data sent by the browser ----

function optionalString(value: unknown, max: number) {
	if (value === null || value === undefined || value === '') return null;
	if (typeof value !== 'string') throw new Error('invalid string');
	return value.slice(0, max);
}

// Parses the hidden JSON field of the item form. Throws on anything unexpected.
export function parseItem(category: Category, json: string): SearchResult {
	const raw = JSON.parse(json) as Record<string, unknown>;

	if (raw.source !== SOURCE_FOR[category]) throw new Error('wrong source');
	if (typeof raw.externalId !== 'string' || !/^\d{1,12}$/.test(raw.externalId)) {
		throw new Error('invalid externalId');
	}
	const title = optionalString(raw.title, 500);
	if (!title) throw new Error('missing title');

	const year = raw.year === null ? null : Number(raw.year);
	if (year !== null && !(Number.isInteger(year) && year > 1800 && year < 2200)) {
		throw new Error('invalid year');
	}

	const releaseDate = optionalString(raw.releaseDate, 10);
	if (releaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate))
		throw new Error('invalid releaseDate');

	const malId = raw.malId === null || raw.malId === undefined ? null : Number(raw.malId);
	if (malId !== null && !(Number.isInteger(malId) && malId > 0)) throw new Error('invalid malId');

	const posterUrl = optionalString(raw.posterUrl, 1000);
	if (posterUrl && !posterUrl.startsWith('https://')) throw new Error('invalid posterUrl');

	return {
		source: SOURCE_FOR[category],
		externalId: raw.externalId,
		title,
		originalTitle: optionalString(raw.originalTitle, 500),
		year,
		releaseDate,
		earlyAccess: raw.earlyAccess === true,
		malId,
		posterUrl,
		overview: optionalString(raw.overview, 5000)
	};
}

// Number of entries per area, e.g. { anime: 9 }.
export function countByCategory() {
	const rows = getDb()
		.select({ category: libraryItems.category, n: count() })
		.from(libraryItems)
		.groupBy(libraryItems.category)
		.all();
	return Object.fromEntries(rows.map((r) => [r.category, r.n])) as Partial<
		Record<Category, number>
	>;
}
