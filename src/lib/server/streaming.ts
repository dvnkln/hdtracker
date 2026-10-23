// The streaming overview: what a user wants to watch, by streaming service ("what of this runs
// at Netflix?"). Only from what is stored – nothing is asked from the data sources.
import { STREAMING_AREAS, type Status } from '#lib/status.js';
import { isStreamingOrder, sortServices, type StreamingOrder } from '#lib/streamingOrder.js';
import { streamingOffersOf } from './itemDetails';
import { listLibrary, type LibraryItem } from './library';
import { serviceKey, storeService } from './providers/streamingServices';
import { enabledCategories, getUserSetting, setUserSettings } from './settings';

// "What I want to watch"
const WANTED: Status[] = ['active', 'paused', 'planned'];

// One tile: the titles in its flat rate, and those only to rent or buy there
export type StreamingService = {
	key: string;
	name: string;
	logoUrl: string;
	ids: number[];
	purchase: number[];
};

export function streamingAreas(userId: number) {
	return enabledCategories(userId).filter((area) => STREAMING_AREAS.includes(area));
}

// Services with the titles in their flat rate. A title that is in no flat rate there but to rent
// or buy counts for the service too, separately: Amazon Video belongs to Prime Video, the Apple
// TV Store to Apple TV, and a store that also streams in a flat rate somewhere in the library is
// that service. Stores that only rent and sell (Videoload, maxdome, Sky Store …) get
// tiles like the services, marked by their bag only. A title with two of them counts for both; a title
// with none, or whose details are not stored yet, is not shown.
export function streamingOverview(userId: number) {
	const items: LibraryItem[] = streamingAreas(userId)
		.flatMap((area) => listLibrary(userId, area))
		.filter((item) => WANTED.includes(item.status));
	const offers = streamingOffersOf(items.map((item) => item.id));

	const services = new Map<string, StreamingService>();
	const stores = new Map<string, StreamingService>();
	const tile = (list: typeof services, key: string, name: string, logoUrl: string) => {
		let found = list.get(key);
		if (!found) list.set(key, (found = { key, name, logoUrl, ids: [], purchase: [] }));
		return found;
	};
	// First the flat rates: they name and draw the services
	for (const item of items) {
		for (const offer of offers.get(item.id)?.flatrate ?? []) {
			const service = tile(services, serviceKey(offer.name), offer.name, offer.logoUrl);
			if (!service.ids.includes(item.id)) service.ids.push(item.id);
		}
	}
	// Then renting and buying: with its streaming service, or else with the store itself
	for (const item of items) {
		for (const offer of offers.get(item.id)?.purchase ?? []) {
			const store = storeService(offer.name);
			const list = store.known || services.has(store.key) ? services : stores;
			const found = tile(list, store.key, store.name, offer.logoUrl);
			if (!found.ids.includes(item.id) && !found.purchase.includes(item.id)) {
				found.purchase.push(item.id);
			}
		}
	}

	const all = [...services.values(), ...stores.values()];
	const listed = new Set(all.flatMap((s) => [...s.ids, ...s.purchase]));
	return {
		items: items.filter((item) => listed.has(item.id)),
		// One list (wish of the user: no separate block for the stores), in the user's order
		services: sortServices(all, streamingOrder(userId))
	};
}

// Services the user hid on the streaming page (by key). Hidden is not gone: they stand small at
// the end of the page and can be shown again; a new service always shows up.
export function hiddenServices(userId: number): string[] {
	try {
		const list: unknown = JSON.parse(getUserSetting(userId, 'streamingHidden'));
		return Array.isArray(list) ? list.filter((key): key is string => typeof key === 'string') : [];
	} catch {
		return [];
	}
}

export function setServiceHidden(userId: number, key: string, hidden: boolean) {
	const keys = new Set(hiddenServices(userId));
	if (hidden) keys.add(key);
	else keys.delete(key);
	setUserSettings(userId, { streamingHidden: JSON.stringify([...keys].sort()) });
}

// How the user wants the tiles: A–Z (the default) or most titles first – remembered per account
export function streamingOrder(userId: number): StreamingOrder {
	const order = getUserSetting(userId, 'streamingOrder');
	return isStreamingOrder(order) ? order : 'name';
}
