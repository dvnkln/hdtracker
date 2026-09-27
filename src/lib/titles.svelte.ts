import type { Category } from '$lib/status';

export type AnimeTitle = 'english' | 'romaji';

// Which anime title is shown on top (setting in the DB, set by the root layout).
const current = $state({ animeTitle: 'english' as AnimeTitle });

export function setAnimeTitle(value: AnimeTitle) {
	current.animeTitle = value;
}

// Main title and the smaller one below it. Anime store the English title in `title` and the
// Romaji one in `originalTitle`; with the "romaji" setting they swap places.
export function titles(category: Category, item: { title: string; originalTitle: string | null }) {
	if (category === 'anime' && current.animeTitle === 'romaji' && item.originalTitle) {
		return { main: item.originalTitle, sub: item.title };
	}
	return { main: item.title, sub: item.originalTitle };
}
