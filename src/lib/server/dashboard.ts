import { and, inArray, ne } from 'drizzle-orm';
import { isOrder, sortByDate, type Order } from '$lib/dashboardOrder';
import type { Category, Status } from '$lib/status';
import { getDb } from './db';
import { libraryItems, releases, watchedEpisodes, type ReleaseKind } from './db/schema';
import { today } from './providers/types';
import { enabledCategories, getSetting } from './settings';

// "Kürzlich erschienen" covers this many days up to today.
const RECENT_DAYS = 28;

// One line on the dashboard. Episodes of a show are grouped into one entry.
export type DashboardEntry = {
	category: Category;
	externalId: string;
	title: string;
	originalTitle: string | null;
	posterUrl: string | null;
	status: Status;
	kind: ReleaseKind;
	date: string | null; // YYYY-MM-DD, null = no date yet
	// Episodes: first and last one (same when it is a single episode)
	season: number | null;
	episode: number | null;
	lastSeason: number | null;
	lastEpisode: number | null;
};

type Row = typeof releases.$inferSelect;

// The remembered order of both lists (see dashboardOrder.ts).
function dashboardOrder(): { recent: Order; upcoming: Order } {
	const recent = getSetting('dashboardRecent');
	const upcoming = getSetting('dashboardUpcoming');
	return {
		recent: isOrder(recent) ? recent : 'desc',
		upcoming: isOrder(upcoming) ? upcoming : 'asc'
	};
}

export function getDashboard(): {
	recent: DashboardEntry[];
	upcoming: DashboardEntry[];
	order: { recent: Order; upcoming: Order };
	libraryEmpty: boolean;
} {
	const order = dashboardOrder();
	const db = getDb();
	// Not dropped, and only areas that are switched on in the settings.
	const items = db
		.select()
		.from(libraryItems)
		.where(
			and(ne(libraryItems.status, 'dropped'), inArray(libraryItems.category, enabledCategories()))
		)
		.all();
	const ids = items.map((i) => i.id);
	if (ids.length === 0) return { recent: [], upcoming: [], order, libraryEmpty: true };

	const rows = db.select().from(releases).where(inArray(releases.itemId, ids)).all();
	const watched = db
		.select()
		.from(watchedEpisodes)
		.where(inArray(watchedEpisodes.itemId, ids))
		.all();

	// Grouped once by item: looking them up per item in the full lists made the dashboard slow
	// for large libraries (thousands of titles).
	const group = <T extends { itemId: number }>(list: T[]) => {
		const byItem = new Map<number, T[]>();
		for (const entry of list) {
			const own = byItem.get(entry.itemId);
			if (own) own.push(entry);
			else byItem.set(entry.itemId, [entry]);
		}
		return byItem;
	};
	const rowsOf = group(rows);
	const watchedOf = group(watched);

	const now = today();
	const recentStart = new Date();
	recentStart.setDate(recentStart.getDate() - RECENT_DAYS);
	const from = recentStart.toLocaleDateString('sv-SE');

	const recent: DashboardEntry[] = [];
	const upcoming: DashboardEntry[] = [];

	for (const item of items) {
		const itemWatched = watchedOf.get(item.id) ?? [];
		const watchedKeys = new Set(itemWatched.map((w) => `${w.season}:${w.episode}`));
		const isWatched = (r: Row) => watchedKeys.has(`${r.season}:${r.episode}`);
		// Highest season with a watched episode (0 = none).
		const lastWatchedSeason = Math.max(0, ...itemWatched.map((w) => w.season));

		let events = rowsOf.get(item.id) ?? [];
		if (item.status === 'completed' || item.status === 'paused') {
			// Only new seasons of shows (e.g. S2 watched, S3 announced); nothing for movies/games.
			if (item.category !== 'series' && item.category !== 'anime') continue;
			events = events.filter((r) => (r.season ?? 0) > lastWatchedSeason);
		}
		events = events.filter((r) => r.kind !== 'episode' || !isWatched(r));

		const base = {
			category: item.category,
			externalId: item.externalId,
			title: item.title,
			originalTitle: item.originalTitle,
			posterUrl: item.posterUrl,
			status: item.status
		};
		const entry = (r: Row, last: Row = r): DashboardEntry => ({
			...base,
			kind: r.kind,
			date: r.date,
			season: r.season,
			episode: r.episode,
			lastSeason: last.season,
			lastEpisode: last.episode
		});
		const byEpisode = (a: Row, b: Row) =>
			(a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0);

		// Movies and games: each date is its own entry.
		for (const r of events.filter((e) => e.kind !== 'episode')) {
			if (r.date === null || r.date > now) upcoming.push(entry(r));
			else if (r.date >= from) recent.push(entry(r));
		}

		// Episodes: all new ones of the last weeks as one entry (dated by the newest) ...
		const episodes = events.filter((e) => e.kind === 'episode').sort(byEpisode);
		const aired = episodes.filter((e) => e.date !== null && e.date <= now && e.date >= from);
		if (aired.length) {
			const newest = aired.reduce((a, b) => (b.date! > a.date! ? b : a));
			recent.push({ ...entry(aired[0], aired.at(-1)), date: newest.date });
		}
		// ... and only the next one that is still to come.
		const next = episodes.find((e) => e.date === null || e.date > now);
		if (next) upcoming.push(entry(next));
	}

	// In the remembered order (newest first / next first unless reversed); entries without a
	// date at the end.
	return {
		recent: sortByDate(recent, order.recent),
		upcoming: sortByDate(upcoming, order.upcoming),
		order,
		libraryEmpty: false
	};
}
