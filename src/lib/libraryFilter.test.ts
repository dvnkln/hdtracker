import { describe, expect, it } from 'vitest';
import type { Person } from '$lib/avatar';
import { countWith, known, offered, passes } from './libraryFilter';

const hans: Person = { id: 3, name: 'Hans', color: 20, picture: null };
const anna: Person = { id: 4, name: 'Anna', color: 340, picture: null };
const netflix = { name: 'Netflix', logoUrl: 'n' };
const prime = { name: 'Prime Video', logoUrl: 'p' };
const title = (name: string, genres: string[], services = [netflix], people: Person[] = []) => ({
	name,
	genres,
	services,
	people
});
const library = [
	title('Funny', ['Comedy'], [netflix], [hans]),
	title('Loud', ['Action'], [netflix], [hans, anna]),
	title('Sad', ['Drama'], [netflix], [hans]),
	title('Funny alone', ['Comedy'], [netflix]),
	title('Funny elsewhere', ['Comedy'], [prime], [hans]),
	title('Nowhere', ['Action', 'Comedy'], [], [anna])
];
const names = (keys: string[]) => library.filter((item) => passes(item, keys)).map((i) => i.name);

describe('filter of the library', () => {
	it('without a filter everything passes', () => {
		expect(names([])).toHaveLength(library.length);
	});

	it('within a group one fit is enough, across groups all have to fit', () => {
		// "All comedies and action films at Netflix with Hans"
		expect(names(['genre:Comedy', 'genre:Action', 'service:Netflix', 'person:3'])).toEqual([
			'Funny',
			'Loud'
		]);
		expect(names(['genre:Comedy', 'genre:Action'])).toHaveLength(5);
		expect(names(['service:Prime Video', 'service:Netflix'])).toHaveLength(5);
	});

	it('tracked together, with one person, or not shared at all', () => {
		expect(names(['shared'])).toHaveLength(5);
		expect(names(['alone'])).toEqual(['Funny alone']);
		expect(names(['person:4'])).toEqual(['Loud', 'Nowhere']);
		// "with Anna or not shared" – both are in the same group
		expect(names(['person:4', 'alone'])).toEqual(['Loud', 'Funny alone', 'Nowhere']);
	});

	it('a key that is no filter filters nothing', () => {
		expect(names(['whatever'])).toHaveLength(library.length);
	});

	it('counts what an entry would leave, given the other groups', () => {
		expect(countWith(library, [], 'genre:Comedy')).toBe(4);
		expect(countWith(library, ['service:Netflix'], 'genre:Comedy')).toBe(2);
		// Another genre that is already on does not narrow the count of this one
		expect(countWith(library, ['service:Netflix', 'genre:Action'], 'genre:Comedy')).toBe(2);
		expect(countWith(library, ['genre:Drama'], 'service:Prime Video')).toBe(0);
	});

	it('offers only what occurs: services by number of titles, genres and people by name', () => {
		const offer = offered(library);
		expect(offer.people.map((p) => p.name)).toEqual(['Anna', 'Hans']);
		expect(offer.services.map((s) => s.name)).toEqual(['Netflix', 'Prime Video']);
		expect(offer.genres).toEqual(['Action', 'Comedy', 'Drama']);
		expect(offered([title('Solo', [], [])])).toEqual({ people: [], services: [], genres: [] });
	});

	it('drops filters from an address that this area does not offer', () => {
		const offer = offered(library);
		expect(known(['genre:Comedy', 'genre:Western', 'person:99', 'shared', 'x'], offer)).toEqual([
			'genre:Comedy',
			'shared'
		]);
		expect(known(['genre:Comedy', 'genre:Comedy'], offer)).toEqual(['genre:Comedy']);
		// Nobody to share with: nothing about sharing can be filtered
		expect(known(['shared', 'alone'], offered([title('Solo', ['Drama'])]))).toEqual([]);
	});
});
