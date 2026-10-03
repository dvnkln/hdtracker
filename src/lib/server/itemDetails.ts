import { eq, notInArray, sql } from 'drizzle-orm';
import { hasEpisodes, type Category } from '$lib/status';
import { getDb } from './db';
import { itemDetails, libraryItems } from './db/schema';
import { getDetails } from './details';
import { getShowDetails } from './episodes';
import { findItem } from './library';
import { today, type Details, type ShowDetails } from './providers/types';
import { refreshSoon } from './releases';
import { enabledCategories } from './settings';

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

// What a detail page needs. The one place that decides between "stored" and "live":
// a title of the library with stored details comes from the database, everything else
// (search results, similar titles, a title that is still loading) is asked from the API.
export async function detailsFor(category: Category, externalId: string) {
	const item = findItem(category, externalId);
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
		.where(notInArray(libraryItems.category, enabledCategories()))
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
