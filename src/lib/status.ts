// Kept free of Svelte/icon imports so drizzle-kit can load it via the DB schema.
export type Category = 'filme' | 'serien' | 'anime' | 'spiele';

// Order = order of the sections on a category page.
export const STATUSES = ['active', 'paused', 'planned', 'completed', 'dropped'] as const;
export type Status = (typeof STATUSES)[number];

// Soft hyphen: invisible, but long words may break there (with a dash) when space is tight.
const SHY = '­';
const DROPPED = `Abge${SHY}brochen`;

// Label per category. A missing entry means the status is not used there.
const LABELS: Record<Category, Partial<Record<Status, string>>> = {
	filme: { planned: 'Geplant', completed: 'Gesehen', dropped: DROPPED },
	serien: {
		active: 'Schaue ich',
		paused: 'Pausiert',
		planned: 'Geplant',
		completed: 'Gesehen',
		dropped: DROPPED
	},
	anime: {
		active: 'Schaue ich',
		paused: 'Pausiert',
		planned: 'Geplant',
		completed: 'Gesehen',
		dropped: DROPPED
	},
	spiele: {
		active: 'Spiele ich',
		paused: 'Pausiert',
		planned: 'Geplant',
		completed: `Durch${SHY}gespielt`,
		dropped: DROPPED
	}
};

// Sections that start collapsed on the category page (they grow long over time).
export const COLLAPSED_STATUSES: Status[] = ['completed', 'dropped'];

export function statusesFor(category: Category): Status[] {
	return STATUSES.filter((s) => LABELS[category][s]);
}

export function statusLabel(category: Category, status: Status) {
	return LABELS[category][status] ?? status;
}

export function isStatusFor(category: Category, value: string): value is Status {
	return (statusesFor(category) as string[]).includes(value);
}
