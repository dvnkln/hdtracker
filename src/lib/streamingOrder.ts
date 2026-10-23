// The order of the tiles on the streaming page: A–Z (the default) or most titles first. Used by
// the server (first answer) and by the page (switching at once, before the server has stored it).
export type StreamingOrder = 'name' | 'count';

export const isStreamingOrder = (value: unknown): value is StreamingOrder =>
	value === 'name' || value === 'count';

// A–Z, or most titles in the subscription first (then most to rent or buy); ties A–Z
export function sortServices<S extends { name: string; ids: unknown[]; purchase: unknown[] }>(
	services: S[],
	order: StreamingOrder
) {
	const byName = (a: S, b: S) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
	return [...services].sort((a, b) =>
		order === 'name'
			? byName(a, b)
			: b.ids.length - a.ids.length || b.purchase.length - a.purchase.length || byName(a, b)
	);
}
