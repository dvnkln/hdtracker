// Order of the two lists on the dashboard; each can be reversed and the choice is remembered
// (a personal setting, see server/settings.ts).
export type Order = 'asc' | 'desc';
export type DashboardSection = 'recent' | 'upcoming';

export const isOrder = (value: unknown): value is Order => value === 'asc' || value === 'desc';
export const isDashboardSection = (value: unknown): value is DashboardSection =>
	value === 'recent' || value === 'upcoming';

// Sorts by date in the given direction. Entries without a date always come last; entries of
// the same day keep their order.
export function sortByDate<T extends { date: string | null }>(entries: T[], order: Order): T[] {
	const dated = entries.filter((e) => e.date !== null);
	const open = entries.filter((e) => e.date === null);
	dated.sort((a, b) => (order === 'asc' ? 1 : -1) * a.date!.localeCompare(b.date!));
	return [...dated, ...open];
}
