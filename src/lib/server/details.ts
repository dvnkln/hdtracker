import type { Category } from '$lib/status';
import { getAnimeInfo } from './providers/anilist';
import { getGameInfo } from './providers/igdb';
import { getMovieInfo, getTvInfo } from './providers/tmdb';
import type { Details } from './providers/types';
import { getSetting } from './settings';

// Picks the right API for the detail page of each area.
export function getDetails(category: Category, id: string): Promise<Details> {
	const language = getSetting('language');
	const region = getSetting('region');
	switch (category) {
		case 'filme':
			return getMovieInfo(id, language, region);
		case 'serien':
			return getTvInfo(id, language, region);
		case 'anime':
			return getAnimeInfo(id);
		case 'spiele':
			return getGameInfo(id);
	}
}
