// Kept free of Svelte/icon imports so drizzle-kit can load it via the DB schema.
// The status names shown to the user live in the i18n files (statusLabels).
export type Category = 'movies' | 'series' | 'anime' | 'games';

// Order = order of the sections on a category page.
export const STATUSES = ['active', 'paused', 'planned', 'completed', 'dropped'] as const;
export type Status = (typeof STATUSES)[number];

// Statuses used per area (movies have no "watching"/"paused").
const USED: Record<Category, Status[]> = {
	movies: ['planned', 'completed', 'dropped'],
	series: [...STATUSES],
	anime: [...STATUSES],
	games: [...STATUSES]
};

// Sections that start collapsed on the category page (they grow long over time).
export const COLLAPSED_STATUSES: Status[] = ['completed', 'dropped'];

export function statusesFor(category: Category): Status[] {
	return USED[category];
}

export function isStatusFor(category: Category, value: string): value is Status {
	return (statusesFor(category) as string[]).includes(value);
}

// Categories with seasons/episodes (they get an episodes page).
export function hasEpisodes(category: Category): category is 'series' | 'anime' {
	return category === 'series' || category === 'anime';
}
