// The filter of the library: by who tracks along, by streaming service, by store and platform
// (games), by genre.
// Several can be on at once – within a group one fit is enough ("comedy or action"), across
// the groups every one has to fit ("… at this service … with this person").
//
// A filter is a short key, so it fits into the address of the page:
//   'shared' · 'alone' · 'person:3' · 'service:Netflix' · 'store:steam' · 'platform:Windows' ·
//   'genre:Comedy'
import type { Person } from '#lib/avatar.js';
import { sellsFor } from '#lib/stores.js';

// What a title is filtered by
export type Filterable = {
	people: { id: number }[]; // who tracks it along (never oneself)
	services: { name: string }[]; // who has it in their flat rate
	stores: string[]; // games: which stores sell it (StoreKey)
	platforms: string[]; // games: what it runs on
	genres: string[];
};

type Group = 'people' | 'service' | 'store' | 'platform' | 'genre';
const PREFIXED: Group[] = ['service', 'store', 'platform', 'genre'];
const groupOf = (key: string): Group =>
	PREFIXED.find((group) => key.startsWith(`${group}:`)) ?? 'people';
const valueOf = (key: string) => key.slice(key.indexOf(':') + 1);

function fits(item: Filterable, key: string) {
	if (key === 'shared') return item.people.length > 0;
	if (key === 'alone') return item.people.length === 0;
	const value = valueOf(key);
	if (key.startsWith('person:')) return item.people.some((person) => String(person.id) === value);
	if (key.startsWith('service:')) return item.services.some((service) => service.name === value);
	if (key.startsWith('store:')) return item.stores.includes(value);
	if (key.startsWith('platform:')) return item.platforms.includes(value);
	if (key.startsWith('genre:')) return item.genres.includes(value);
	return true; // not a filter we know: it filters nothing
}

// Whether a title passes the filters that are on.
//
// Store and platform go together: with both on, one of the chosen stores has to sell the game
// for one of the chosen platforms ("Steam or GOG, for Windows") – a game for Xbox that is also in the
// PlayStation Store does not pass "PlayStation Store + Xbox".
export function passes(item: Filterable, keys: Iterable<string>) {
	const groups = new Map<Group, string[]>();
	for (const key of keys) groups.set(groupOf(key), [...(groups.get(groupOf(key)) ?? []), key]);
	const stores = groups.get('store');
	const platforms = groups.get('platform');
	if (stores && platforms) {
		groups.delete('store');
		groups.delete('platform');
		const fitsPair = stores.some((store) =>
			platforms.some(
				(platform) =>
					fits(item, store) && fits(item, platform) && sellsFor(valueOf(store), valueOf(platform))
			)
		);
		if (!fitsPair) return false;
	}
	return [...groups.values()].every((group) => group.some((key) => fits(item, key)));
}

// How many titles there would be with this filter on: with what is on in the *other* groups,
// and this one alone in its own. (What the window shows behind each entry.)
export function countWith<T extends Filterable>(items: T[], keys: Iterable<string>, key: string) {
	const others = [...keys].filter((other) => groupOf(other) !== groupOf(key));
	return items.filter((item) => passes(item, [...others, key])).length;
}

// Values with the most titles first (ties keep the order they came in).
function byCount(lists: string[][]) {
	const counts = new Map<string, number>();
	for (const list of lists)
		for (const value of list) counts.set(value, (counts.get(value) ?? 0) + 1);
	return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([value]) => value);
}

// What an area offers to filter by: only what occurs in it. Services, stores and platforms
// with the most titles first, genres from A to Z.
export function offered<S extends { name: string }>(
	items: {
		people: Person[];
		services: S[];
		stores: string[];
		platforms: string[];
		genres: string[];
	}[]
) {
	const people = new Map<number, Person>();
	const services = new Map<string, { service: S; count: number }>();
	const genres = new Set<string>();
	for (const item of items) {
		for (const person of item.people) people.set(person.id, person);
		for (const service of item.services) {
			const known = services.get(service.name);
			if (known) known.count++;
			else services.set(service.name, { service, count: 1 });
		}
		for (const genre of item.genres) genres.add(genre);
	}
	return {
		people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name, 'de')),
		services: [...services.values()].sort((a, b) => b.count - a.count).map((one) => one.service),
		stores: byCount(items.map((item) => item.stores)),
		platforms: byCount(items.map((item) => item.platforms)),
		genres: [...genres].sort((a, b) => a.localeCompare(b, 'de'))
	};
}

// The filters named in an address (?f=…&f=…) that this area really offers – a filter that no
// longer fits anything (somebody left, another area) is dropped instead of hiding everything.
export function known(
	keys: string[],
	offer: {
		people: { id: number }[];
		services: { name: string }[];
		stores: string[];
		platforms: string[];
		genres: string[];
	}
) {
	const valid = new Set([
		...(offer.people.length ? ['shared', 'alone'] : []),
		...offer.people.map((person) => `person:${person.id}`),
		...offer.services.map((service) => `service:${service.name}`),
		...offer.stores.map((store) => `store:${store}`),
		...offer.platforms.map((platform) => `platform:${platform}`),
		...offer.genres.map((genre) => `genre:${genre}`)
	]);
	return [...new Set(keys)].filter((key) => valid.has(key));
}
