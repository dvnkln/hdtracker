import type { Category } from '$lib/categories';
import { searchAnime } from './providers/anilist';
import { searchGames } from './providers/igdb';
import { searchMovies, searchTv } from './providers/tmdb';
import type { SearchResult } from './providers/types';
import { getSetting } from './settings';

// Picks the right API for each area of the app.
export function searchCategory(category: Category, query: string): Promise<SearchResult[]> {
	const language = getSetting('language');
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
}
