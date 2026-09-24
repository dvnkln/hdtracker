import { and, eq } from 'drizzle-orm';
import { hasEpisodes, type Category, type Status } from '$lib/status';
import { getDb } from './db';
import { libraryItems, watchedEpisodes } from './db/schema';
import { findItem, saveItem } from './library';
import { getAnimeDetails } from './providers/anilist';
import { getTvDetails } from './providers/tmdb';
import type { ShowDetails } from './providers/types';
import { getSetting } from './settings';

export { findItem, hasEpisodes };

export type EpisodeRef = { season: number; episode: number };

export function getShowDetails(category: 'serien' | 'anime', id: string) {
	return category === 'serien' ? getTvDetails(id, getSetting('language')) : getAnimeDetails(id);
}

const key = (season: number, episode: number) => `${season}:${episode}`;

// Watched episodes of a library item as a set of "season:episode" keys.
export function watchedKeys(itemId: number | undefined) {
	if (itemId === undefined) return new Set<string>();
	const rows = getDb()
		.select({ season: watchedEpisodes.season, episode: watchedEpisodes.episode })
		.from(watchedEpisodes)
		.where(eq(watchedEpisodes.itemId, itemId))
		.all();
	return new Set(rows.map((r) => key(r.season, r.episode)));
}

// All aired episodes (optionally only one season). Specials only if their season is asked for.
export function airedEpisodes(details: ShowDetails, season?: number): EpisodeRef[] {
	return details.seasons
		.filter((s) => (season === undefined ? !s.special : s.number === season))
		.flatMap((s) =>
			s.episodes.filter((e) => e.aired).map((e) => ({ season: s.number, episode: e.number }))
		);
}

// Marks episodes as watched or unwatched, then updates the status automatically.
export function setEpisodes(
	category: 'serien' | 'anime',
	details: ShowDetails,
	targets: EpisodeRef[],
	watched: boolean
) {
	// Only episodes that exist and have aired can be changed.
	const allowed = new Set(
		details.seasons.flatMap((s) =>
			s.episodes.filter((e) => e.aired).map((e) => key(s.number, e.number))
		)
	);
	const valid = targets.filter((t) => allowed.has(key(t.season, t.episode)));
	if (valid.length === 0) return;

	const db = getDb();
	db.transaction((tx) => {
		let item = findItem(category, details.item.externalId);
		if (!item) {
			if (!watched) return;
			// First watched episode of a title that is not in the library yet: add it.
			saveItem(category, details.item, 'active');
			item = findItem(category, details.item.externalId)!;
		}

		for (const t of valid) {
			if (watched) {
				tx.insert(watchedEpisodes)
					.values({ itemId: item.id, season: t.season, episode: t.episode })
					.onConflictDoNothing()
					.run();
			} else {
				tx.delete(watchedEpisodes)
					.where(
						and(
							eq(watchedEpisodes.itemId, item.id),
							eq(watchedEpisodes.season, t.season),
							eq(watchedEpisodes.episode, t.episode)
						)
					)
					.run();
			}
		}

		const next = autoStatus(item.status, details, watchedKeys(item.id), watched);
		if (next !== item.status) {
			tx.update(libraryItems)
				.set({ status: next, statusChangedAt: new Date() })
				.where(eq(libraryItems.id, item.id))
				.run();
		}
	});
}

// Status rules (see CLAUDE.md, point 5):
// - watching an episode of a planned/paused title -> "active"
// - all aired episodes of an ended show watched -> "completed"
// - an episode of a "completed" show unmarked -> back to "active"
// "dropped" is never changed automatically.
function autoStatus(
	current: Status,
	details: ShowDetails,
	watchedSet: Set<string>,
	justWatched: boolean
): Status {
	if (current === 'dropped') return current;

	const aired = airedEpisodes(details);
	const allWatched =
		aired.length > 0 && aired.every((e) => watchedSet.has(key(e.season, e.episode)));

	if (allWatched && details.ended) return 'completed';
	if (!allWatched && current === 'completed' && !justWatched) return 'active';
	if (justWatched && (current === 'planned' || current === 'paused')) return 'active';
	return current;
}
