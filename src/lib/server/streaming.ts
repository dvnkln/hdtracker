// The streaming overview: what a user wants to watch, by streaming service ("what of this runs
// at Netflix?"). Only from what is stored – nothing is asked from the data sources.
import { isReleased, STREAMING_AREAS, type Status } from '#lib/status.js';
import { filterFactsOf } from './itemDetails';
import { listLibrary, type LibraryItem } from './library';
import { today } from './providers/types';
import { enabledCategories } from './settings';

// "What I want to watch"
const WANTED: Status[] = ['active', 'paused', 'planned'];

export type StreamingService = { name: string; logoUrl: string; ids: number[] };

export function streamingAreas(userId: number) {
	return enabledCategories(userId).filter((area) => STREAMING_AREAS.includes(area));
}

// Services with the titles in their flat rate (most titles first), and what is out but in no
// flat rate. A title with two services counts for both. Left out: titles whose details are not
// stored yet (nothing known about their offers) and, among those without a flat rate, what is
// not out yet – nobody streams that anyway.
export function streamingOverview(userId: number) {
	const items: LibraryItem[] = streamingAreas(userId)
		.flatMap((area) => listLibrary(userId, area))
		.filter((item) => WANTED.includes(item.status));
	const facts = filterFactsOf(items.map((item) => item.id));
	const day = today();

	const services = new Map<string, StreamingService>();
	const nowhere: number[] = [];
	const shown: LibraryItem[] = [];
	for (const item of items) {
		const known = facts.get(item.id);
		if (!known) continue;
		if (known.services.length === 0) {
			if (!isReleased(item, day)) continue;
			nowhere.push(item.id);
		}
		for (const service of known.services) {
			const entry = services.get(service.name) ?? { ...service, ids: [] };
			entry.ids.push(item.id);
			services.set(service.name, entry);
		}
		shown.push(item);
	}
	return {
		items: shown,
		services: [...services.values()].sort(
			(a, b) => b.ids.length - a.ids.length || a.name.localeCompare(b.name, 'de')
		),
		nowhere
	};
}
