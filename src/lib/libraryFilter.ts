// The filter of the library: by who tracks along, by streaming service, by genre.
// Several can be on at once – within a group one fit is enough ("comedy or action"), across
// the groups every one has to fit ("… at this service … with this person").
//
// A filter is a short key, so it fits into the address of the page:
//   'shared' · 'alone' · 'person:3' · 'service:Netflix' · 'genre:Comedy'
import type { Person } from '#lib/avatar.js';

// What a title is filtered by
export type Filterable = {
	people: { id: number }[]; // who tracks it along (never oneself)
	services: { name: string }[]; // who has it in their flat rate
	genres: string[];
};

type Group = 'people' | 'service' | 'genre';
const groupOf = (key: string): Group =>
	key.startsWith('service:') ? 'service' : key.startsWith('genre:') ? 'genre' : 'people';
const valueOf = (key: string) => key.slice(key.indexOf(':') + 1);

function fits(item: Filterable, key: string) {
	if (key === 'shared') return item.people.length > 0;
	if (key === 'alone') return item.people.length === 0;
	const value = valueOf(key);
	if (key.startsWith('person:')) return item.people.some((person) => String(person.id) === value);
	if (key.startsWith('service:')) return item.services.some((service) => service.name === value);
	if (key.startsWith('genre:')) return item.genres.includes(value);
	return true; // not a filter we know: it filters nothing
}

// Whether a title passes the filters that are on.
export function passes(item: Filterable, keys: Iterable<string>) {
	const groups = new Map<Group, string[]>();
	for (const key of keys) groups.set(groupOf(key), [...(groups.get(groupOf(key)) ?? []), key]);
	return [...groups.values()].every((group) => group.some((key) => fits(item, key)));
}

// How many titles there would be with this filter on: with what is on in the *other* groups,
// and this one alone in its own. (What the window shows behind each entry.)
export function countWith<T extends Filterable>(items: T[], keys: Iterable<string>, key: string) {
	const others = [...keys].filter((other) => groupOf(other) !== groupOf(key));
	return items.filter((item) => passes(item, [...others, key])).length;
}

// What an area offers to filter by: only what occurs in it. Services with the most titles
// first, genres from A to Z.
export function offered<S extends { name: string }>(
	items: { people: Person[]; services: S[]; genres: string[] }[]
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
		genres: [...genres].sort((a, b) => a.localeCompare(b, 'de'))
	};
}

// The filters named in an address (?f=…&f=…) that this area really offers – a filter that no
// longer fits anything (somebody left, another area) is dropped instead of hiding everything.
export function known(
	keys: string[],
	offer: { people: { id: number }[]; services: { name: string }[]; genres: string[] }
) {
	const valid = new Set([
		...(offer.people.length ? ['shared', 'alone'] : []),
		...offer.people.map((person) => `person:${person.id}`),
		...offer.services.map((service) => `service:${service.name}`),
		...offer.genres.map((genre) => `genre:${genre}`)
	]);
	return [...new Set(keys)].filter((key) => valid.has(key));
}
