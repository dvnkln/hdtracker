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

// Whether a title is out yet (first release anywhere, `today` as YYYY-MM-DD). Library items
// whose details are still loading (metadataUpdatedAt empty) count as released: unknown must
// not lock anything.
export function isReleased(
	item: { releaseDate: string | null; metadataUpdatedAt?: Date | null },
	today: string
) {
	if (item.metadataUpdatedAt === null) return true;
	return item.releaseDate !== null && item.releaseDate <= today;
}

// What is not out yet can only be planned – not watched, paused, finished or dropped.
export function allowedStatuses(category: Category, released: boolean): Status[] {
	return released ? statusesFor(category) : ['planned'];
}

// Categories with seasons/episodes (they get an episodes page).
export function hasEpisodes(category: Category): category is 'series' | 'anime' {
	return category === 'series' || category === 'anime';
}
