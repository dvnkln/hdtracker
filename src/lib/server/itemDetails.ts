import type { AnimeFacts } from '#lib/animeSeries.js';
import { eq, inArray, notInArray, sql } from 'drizzle-orm';
import { hasEpisodes, type Category } from '#lib/status.js';
import { getDb } from './db';
import { itemDetails, libraryItems } from './db/schema';
import { getDetails } from './details';
import { getShowDetails } from './episodes';
import { findTitle } from './library';
import { today, type Details, type ShowDetails } from './providers/types';
import { refreshSoon } from './releases';
import type { StoreKey } from '#lib/stores.js';
import { shownCategories } from './settings';

// Everything a detail page shows is kept in the database for the titles of the library, so
// their pages open without asking TMDB, IGDB or AniList. refreshItem() (releases.ts) fills it:
// right after adding or importing a title and every night.

// A stored copy older than this is still shown, but refreshed in the background.
const FRESH_MS = 60 * 60 * 1000;

export function saveDetails(itemId: number, info: Details, show: ShowDetails | null) {
	const values = { info, show, fetchedAt: new Date() };
	getDb()
		.insert(itemDetails)
		.values({ itemId, ...values })
		.onConflictDoUpdate({ target: itemDetails.itemId, set: values })
		.run();
}

// What is stored about a title right now, as it was saved (before a refresh replaces it).
export function storedDetails(itemId: number) {
	return getDb()
		.select({ info: itemDetails.info, show: itemDetails.show })
		.from(itemDetails)
		.where(eq(itemDetails.itemId, itemId))
		.get();
}

// Episodes are marked as aired when the details are loaded. A stored copy can be from
// yesterday, so episodes whose air date has come since count as aired as well.
function withAiredToday(show: ShowDetails): ShowDetails {
	const now = today();
	return {
		...show,
		seasons: show.seasons.map((s) => ({
			...s,
			episodes: s.episodes.map((e) => ({
				...e,
				aired: e.aired || (!!e.airDate && e.airDate <= now)
			}))
		}))
	};
}

// The stored trailer links of some titles (title -> address); titles without one are left out.
export function trailersOf(itemIds: number[]) {
	if (itemIds.length === 0) return new Map<number, string>();
	const rows = getDb()
		.select({ itemId: itemDetails.itemId, info: itemDetails.info })
		.from(itemDetails)
		.where(inArray(itemDetails.itemId, itemIds))
		.all();
	return new Map(
		rows.flatMap((row) => (row.info.trailerUrl ? [[row.itemId, row.info.trailerUrl] as const] : []))
	);
}

// What the library can be filtered by, from the stored details of some titles: their genres,
// the streaming services that have them in their flat rate (renting and buying do not count –
// the question is "what of this runs at …"), and for games the stores and platforms. Titles
// without stored details are left out.
export function filterFactsOf(itemIds: number[]) {
	type Facts = {
		genres: string[];
		services: { name: string; logoUrl: string }[];
		stores: StoreKey[];
		platforms: string[];
	};
	if (itemIds.length === 0) return new Map<number, Facts>();
	const rows = getDb()
		.select({ itemId: itemDetails.itemId, info: itemDetails.info })
		.from(itemDetails)
		.where(inArray(itemDetails.itemId, itemIds))
		.all();
	return new Map<number, Facts>(
		rows.map((row) => [
			row.itemId,
			{
				genres: row.info.genres ?? [],
				services: (row.info.watch?.flatrate ?? []).map(({ name, logoUrl }) => ({ name, logoUrl })),
				stores: (row.info.stores ?? []).map((store) => store.key),
				platforms: row.info.platforms ?? []
			}
		])
	);
}

// The streaming offers of titles, for the streaming overview: in a flat rate, and to rent or buy
// (one list, each store once). Titles without stored details are left out.
export function streamingOffersOf(itemIds: number[]) {
	type Offer = { name: string; logoUrl: string };
	if (itemIds.length === 0) return new Map<number, { flatrate: Offer[]; purchase: Offer[] }>();
	const rows = getDb()
		.select({ itemId: itemDetails.itemId, info: itemDetails.info })
		.from(itemDetails)
		.where(inArray(itemDetails.itemId, itemIds))
		.all();
	const plain = ({ name, logoUrl }: Offer) => ({ name, logoUrl });
	return new Map(
		rows.map((row) => {
			const watch = row.info.watch;
			const purchase = new Map<string, Offer>();
			for (const offer of [...(watch?.rent ?? []), ...(watch?.buy ?? [])]) {
				if (!purchase.has(offer.name)) purchase.set(offer.name, plain(offer));
			}
			return [
				row.itemId,
				{ flatrate: (watch?.flatrate ?? []).map(plain), purchase: [...purchase.values()] }
			];
		})
	);
}

// Anime: what each one is and what it belongs with, for showing series as one in the library
// (src/lib/animeSeries.ts). Titles without stored details (yet) have none.
export function animeFactsOf(itemIds: number[]) {
	if (itemIds.length === 0) return new Map<number, AnimeFacts>();
	// Only that part of the stored details (the rest – texts, offers, similar titles – is large)
	const rows = getDb()
		.select({
			itemId: itemDetails.itemId,
			anime: sql<string | null>`json_extract(${itemDetails.info}, '$.anime')`
		})
		.from(itemDetails)
		.where(inArray(itemDetails.itemId, itemIds))
		.all();
	return new Map(
		rows.flatMap((row) =>
			row.anime ? [[row.itemId, JSON.parse(row.anime) as AnimeFacts] as const] : []
		)
	);
}

// What a detail page needs. The one place that decides between "stored" and "live":
// a title of somebody's library with stored details comes from the database, everything else
// (search results, similar titles, a title that is still loading) is asked from the API.
export async function detailsFor(category: Category, externalId: string) {
	const item = findTitle(category, externalId);
	const stored = item
		? getDb().select().from(itemDetails).where(eq(itemDetails.itemId, item.id)).get()
		: undefined;
	if (item && stored) {
		if (stored.fetchedAt.getTime() < Date.now() - FRESH_MS) refreshSoon(item);
		return { info: stored.info, show: stored.show ? withAiredToday(stored.show) : null };
	}
	const [info, show] = await Promise.all([
		getDetails(category, externalId),
		hasEpisodes(category) ? getShowDetails(category, externalId) : null
	]);
	return { info, show };
}

// Hidden areas are not kept up to date, so their stored details are dropped. Their titles
// count as "details not loaded" again and are loaded when the area is shown again.
export function deleteDetailsOfHiddenAreas() {
	const db = getDb();
	const hidden = db
		.select({ id: itemDetails.itemId })
		.from(itemDetails)
		.innerJoin(libraryItems, eq(libraryItems.id, itemDetails.itemId))
		.where(notInArray(libraryItems.category, shownCategories()))
		.all();
	for (const { id } of hidden) {
		db.delete(itemDetails).where(eq(itemDetails.itemId, id)).run();
		db.update(libraryItems).set({ metadataUpdatedAt: null }).where(eq(libraryItems.id, id)).run();
	}
}

// Items whose series or anime is over according to the stored details (ended or cancelled).
export function endedShowIds() {
	const rows = getDb()
		.select({ id: itemDetails.itemId })
		.from(itemDetails)
		.where(sql`json_extract(${itemDetails.show}, '$.ended') = 1`)
		.all();
	return new Set(rows.map((r) => r.id));
}

// How many titles have stored details and how much space they take.
export function detailsStats() {
	const row = getDb()
		.select({
			count: sql<number>`count(*)`,
			bytes: sql<number>`coalesce(sum(length(${itemDetails.info}) + coalesce(length(${itemDetails.show}), 0)), 0)`
		})
		.from(itemDetails)
		.get();
	return { count: row?.count ?? 0, bytes: row?.bytes ?? 0 };
}
