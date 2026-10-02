import { and, count, eq, inArray, isNull, ne, notInArray } from 'drizzle-orm';
import { hasEpisodes, type Category } from '$lib/status';
import { getDb } from './db';
import { getImage } from './images';
import { deleteDetailsOfHiddenAreas, saveDetails } from './itemDetails';
import { libraryItems, releases, watchedEpisodes } from './db/schema';
import { getDetails } from './details';
import { airedEpisodes, getShowDetails } from './episodes';
import { serverMessages } from './i18n';
import type { LibraryItem } from './library';
import { getAnimeReleases } from './providers/anilist';
import { getGameReleases } from './providers/igdb';
import { getMovieReleases, getTvDetails } from './providers/tmdb';
import {
	ProviderError,
	runInBackground,
	type ReleaseEvent,
	type ReleaseInfo
} from './providers/types';
import { enabledCategories, getSetting } from './settings';

// Episodes are kept from this many days ago on (the dashboard shows the last 4 weeks).
const KEEP_DAYS = 60;

function daysAgo(days: number) {
	const d = new Date();
	d.setDate(d.getDate() - days);
	return d.toLocaleDateString('sv-SE');
}

// Series: aired and upcoming episodes of the regular seasons. A season without any episode
// dates (announced) becomes one event for its first episode, with the season date if known.
async function getSeriesReleases(id: string, language: string): Promise<ReleaseInfo> {
	const details = await getTvDetails(id, language);
	const since = daysAgo(KEEP_DAYS);
	const events: ReleaseEvent[] = [];
	for (const season of details.seasons.filter((s) => !s.special)) {
		const dated = season.episodes.filter((e) => e.airDate);
		if (dated.length === 0) {
			if (!season.airDate || season.airDate >= since) {
				events.push({ kind: 'episode', date: season.airDate, season: season.number, episode: 1 });
			}
			continue;
		}
		for (const e of dated) {
			if (e.airDate! >= since) {
				events.push({ kind: 'episode', date: e.airDate, season: season.number, episode: e.number });
			}
		}
	}
	return { item: details.item, events };
}

function fetchReleases(category: Category, externalId: string): Promise<ReleaseInfo> {
	const language = getSetting('language');
	switch (category) {
		case 'movies':
			return getMovieReleases(externalId, language, getSetting('region'));
		case 'series':
			return getSeriesReleases(externalId, language);
		case 'anime':
			return getAnimeReleases(externalId);
		case 'games':
			return getGameReleases(externalId);
	}
}

// Loads everything about one library item and stores it: title and poster, release dates
// (dashboard), all details of its detail page and the images shown there. After this, the
// item's pages open without asking the API.
export async function refreshItem(item: LibraryItem) {
	const { item: fresh, events } = await fetchReleases(item.category, item.externalId);
	const info = await getDetails(item.category, item.externalId);
	const show = hasEpisodes(item.category)
		? await getShowDetails(item.category, item.externalId)
		: null;

	const saved = getDb().transaction((tx) => {
		const updated = tx
			.update(libraryItems)
			.set({
				title: fresh.title,
				originalTitle: fresh.originalTitle,
				year: fresh.year,
				releaseDate: fresh.releaseDate,
				earlyAccess: fresh.earlyAccess,
				posterUrl: fresh.posterUrl,
				overview: fresh.overview,
				metadataUpdatedAt: new Date()
			})
			.where(eq(libraryItems.id, item.id))
			.run();
		// Removed from the library meanwhile (e.g. library cleared while loading): nothing to save.
		if (updated.changes === 0) return false;
		tx.delete(releases).where(eq(releases.itemId, item.id)).run();
		if (events.length) {
			tx.insert(releases)
				.values(events.map((e) => ({ ...e, itemId: item.id })))
				.run();
		}
		return true;
	});
	if (!saved) return;
	saveDetails(item.id, info, show);

	// Keep the images at the top of the detail page in the image store and fresh. Episode
	// images and the posters of similar titles take a lot of space and are further down the
	// page: they are loaded when somebody looks at them. A missing image must not make the
	// whole refresh fail.
	const images = [
		fresh.posterUrl,
		info.backdropUrl,
		...(info.watch ? [...info.watch.flatrate, ...info.watch.rent, ...info.watch.buy] : []).map(
			(p) => p.logoUrl
		)
	];
	await Promise.all(
		[...new Set(images)].filter((url) => url !== null).map((url) => getImage(url).catch(() => null))
	);
}

type Source = LibraryItem['source'];
const SOURCES: Source[] = ['tmdb', 'igdb', 'anilist'];

// Per service only one refresh runs at a time (queue, nightly task, "Run now"), so together
// they never exceed that service's rate limit. Different services work in parallel.
const locks: Record<Source, Promise<unknown>> = {
	tmdb: Promise.resolve(),
	igdb: Promise.resolve(),
	anilist: Promise.resolve()
};
function exclusive<T>(source: Source, work: () => Promise<T>): Promise<T> {
	const run = locks[source].then(() => runInBackground(work));
	locks[source] = run.catch(() => {});
	return run;
}

// Refreshes one item in the background, e.g. when its detail page shows an older stored copy.
// Never twice at the same time for one item; waits its turn behind other work for the service.
const refreshing = new Set<number>();
export function refreshSoon(item: LibraryItem) {
	if (refreshing.has(item.id)) return;
	refreshing.add(item.id);
	exclusive(item.source, () => refreshItem(item))
		.catch((err) => console.error(`Refreshing ${item.category}/${item.externalId} failed`, err))
		.finally(() => refreshing.delete(item.id));
}

const isRateLimited = (err: unknown) => err instanceof ProviderError && err.status === 429;

// A finished series imported without single episodes: tick all aired episodes once.
async function tickAllEpisodesIfImported(item: LibraryItem) {
	if (item.category !== 'series' || item.status !== 'completed') return;
	const db = getDb();
	const watched = db
		.select()
		.from(watchedEpisodes)
		.where(eq(watchedEpisodes.itemId, item.id))
		.get();
	if (watched) return;
	const details = await getShowDetails('series', item.externalId);
	// Removed from the library while loading: nothing to tick.
	if (!db.select().from(libraryItems).where(eq(libraryItems.id, item.id)).get()) return;
	for (const e of airedEpisodes(details)) {
		db.insert(watchedEpisodes)
			.values({ itemId: item.id, season: e.season, episode: e.episode })
			.onConflictDoNothing()
			.run();
	}
}

// ---- Queue: items whose details were never loaded (just added or imported) ----

const queued: Record<Source, boolean> = { tmdb: false, igdb: false, anilist: false };

// Loads all items without details: one worker per service, the services in parallel. Called
// after adding or importing and at startup, so an interrupted run (restart) simply continues.
// Items that fail are skipped for this run; the nightly task tries them again.
export function refreshPending() {
	for (const source of SOURCES) {
		if (queued[source]) continue;
		queued[source] = true;
		exclusive(source, async () => {
			queued[source] = false;
			const failed: number[] = [];
			for (;;) {
				const item = getDb()
					.select()
					.from(libraryItems)
					.where(
						and(
							eq(libraryItems.source, source),
							inArray(libraryItems.category, enabledCategories()),
							isNull(libraryItems.metadataUpdatedAt),
							failed.length ? notInArray(libraryItems.id, failed) : undefined
						)
					)
					.orderBy(libraryItems.id)
					.get();
				if (!item) break;
				try {
					await tickAllEpisodesIfImported(item);
					await refreshItem(item);
				} catch (err) {
					failed.push(item.id);
					console.error(`Loading ${item.category}/${item.externalId} failed`, err);
					// Still too many requests after waiting: pause, continue with the next trigger.
					if (isRateLimited(err)) break;
				}
			}
		}).catch((err) => console.error(`Loading details (${source}) failed`, err));
	}
}

// How many items still wait for their details, and roughly how long that takes (seconds).
export function pendingStatus() {
	const rows = getDb()
		.select({ source: libraryItems.source, n: count() })
		.from(libraryItems)
		.where(
			and(
				isNull(libraryItems.metadataUpdatedAt),
				inArray(libraryItems.category, enabledCategories())
			)
		)
		.groupBy(libraryItems.source)
		.all();
	const perItem: Record<LibraryItem['source'], number> = { tmdb: 0.6, igdb: 0.8, anilist: 3.2 };
	return {
		pending: rows.reduce((sum, r) => sum + r.n, 0),
		// The services load in parallel, so the slowest one decides.
		seconds: Math.ceil(Math.max(0, ...rows.map((r) => r.n * perItem[r.source])))
	};
}

// Background task "metadata": refreshes all items except dropped ones and hidden areas; one
// after another per service, the services in parallel.
export async function refreshAll() {
	deleteDetailsOfHiddenAreas();
	const items = getDb()
		.select()
		.from(libraryItems)
		.where(
			and(ne(libraryItems.status, 'dropped'), inArray(libraryItems.category, enabledCategories()))
		)
		.all();
	const failedPerSource = await Promise.all(
		SOURCES.map((source) =>
			exclusive(source, async () => {
				const mine = items.filter((i) => i.source === source);
				let failed = 0;
				for (const [index, item] of mine.entries()) {
					try {
						await refreshItem(item);
					} catch (err) {
						failed++;
						console.error(`Refreshing ${item.category}/${item.externalId} failed`, err);
						if (isRateLimited(err)) return failed + mine.length - index - 1;
					}
				}
				return failed;
			})
		)
	);
	const failed = failedPerSource.reduce((a, b) => a + b, 0);
	if (failed) throw new Error(serverMessages().maintenance.refreshFailed(failed, items.length));
}
