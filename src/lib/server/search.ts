import type { Category } from '#lib/categories.js';
import { cached } from './cache';
import { searchAnime } from './providers/anilist';
import { searchGames } from './providers/igdb';
import { searchMovies, searchTv } from './providers/tmdb';
import type { SearchResult } from './providers/types';
import { getSetting } from './settings';

// A search is kept for a while: the page asks again after every change of status in it (to
// show the new status), and adding a few anime from one search would otherwise ask AniList each
// time – until it slows down and the results give way to its message. The status of each hit
// comes from the library, fresh every time; only the hits are kept. Failures are not kept.
const SEARCH_MS = 30 * 60_000;

// The last hits of each search that worked, kept longer (the newest LAST_KEPT searches): when the
// page asks again and the source fails (AniList slowing down), it keeps showing them and says why
// in a short message – the user stays where they were, an open window stays open.
const LAST_KEPT = 50;
const lastHits = new Map<string, SearchResult[]>();

const keyOf = (category: Category, query: string) =>
	`search:${category}:${getSetting('language')}:${query.toLowerCase()}`;

// A search, or – if the source fails – the hits it gave last time with what went wrong
// (`failed`); throws when it never worked.
export async function searchOrLast(
	category: Category,
	query: string
): Promise<{ hits: SearchResult[]; failed: unknown }> {
	const key = keyOf(category, query);
	try {
		const hits = await searchCategory(category, query);
		lastHits.delete(key);
		lastHits.set(key, hits);
		if (lastHits.size > LAST_KEPT) lastHits.delete(lastHits.keys().next().value!);
		return { hits, failed: null };
	} catch (err) {
		const last = lastHits.get(key);
		if (!last) throw err;
		return { hits: last, failed: err };
	}
}

// Picks the right API for each area of the app.
export function searchCategory(category: Category, query: string): Promise<SearchResult[]> {
	const language = getSetting('language');
	return cached(keyOf(category, query), SEARCH_MS, () => {
		switch (category) {
			case 'movies':
				return searchMovies(query, language);
			case 'series':
				return searchTv(query, language);
			case 'anime':
				return searchAnime(query);
			case 'games':
				return searchGames(query);
		}
	});
}
