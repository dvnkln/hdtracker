import { eq, ne } from 'drizzle-orm';
import type { Category } from '$lib/status';
import { getDb } from './db';
import { libraryItems, releases } from './db/schema';
import { serverMessages } from './i18n';
import { findItem, type LibraryItem } from './library';
import { getAnimeReleases } from './providers/anilist';
import { getGameReleases } from './providers/igdb';
import { getMovieReleases, getTvDetails } from './providers/tmdb';
import type { ReleaseEvent, ReleaseInfo } from './providers/types';
import { getSetting } from './settings';

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
			return getAnimeReleases(externalId, KEEP_DAYS);
		case 'games':
			return getGameReleases(externalId);
	}
}

// Minimum pause between two requests per source, to stay below the rate limits
// (AniList currently allows about 30 requests per minute).
const PAUSE_MS: Record<LibraryItem['source'], number> = { tmdb: 100, igdb: 300, anilist: 2100 };
const lastRequest: Record<string, number> = {};

async function throttle(source: LibraryItem['source']) {
	const wait = (lastRequest[source] ?? 0) + PAUSE_MS[source] - Date.now();
	if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
	lastRequest[source] = Date.now();
}

// Loads the current metadata (title, poster, ...) and release dates of one library item.
export async function refreshItem(item: LibraryItem) {
	await throttle(item.source);
	const { item: fresh, events } = await fetchReleases(item.category, item.externalId);
	getDb().transaction((tx) => {
		tx.update(libraryItems)
			.set({
				title: fresh.title,
				originalTitle: fresh.originalTitle,
				year: fresh.year,
				posterUrl: fresh.posterUrl,
				overview: fresh.overview
			})
			.where(eq(libraryItems.id, item.id))
			.run();
		tx.delete(releases).where(eq(releases.itemId, item.id)).run();
		if (events.length) {
			tx.insert(releases)
				.values(events.map((e) => ({ ...e, itemId: item.id })))
				.run();
		}
	});
}

// Right after adding a title: load its dates without waiting for the nightly run.
export function refreshInBackground(category: Category, externalId: string) {
	const item = findItem(category, externalId);
	if (!item) return;
	refreshItem(item).catch((err) =>
		console.error(`Refreshing ${category}/${externalId} failed`, err)
	);
}

// Background task "metadata": refreshes all items except dropped ones, one after another.
export async function refreshAll() {
	const items = getDb().select().from(libraryItems).where(ne(libraryItems.status, 'dropped')).all();
	let failed = 0;
	for (const item of items) {
		try {
			await refreshItem(item);
		} catch (err) {
			failed++;
			console.error(`Refreshing ${item.category}/${item.externalId} failed`, err);
		}
	}
	if (failed) throw new Error(serverMessages().maintenance.refreshFailed(failed, items.length));
}
