import { describe, expect, it } from 'vitest';
import type { Person } from '#lib/avatar.js';
import { countWith, known, offered, passes } from './libraryFilter';

const hans: Person = { id: 3, name: 'Hans', color: 20, picture: null };
const anna: Person = { id: 4, name: 'Anna', color: 340, picture: null };
const netflix = { name: 'Netflix', logoUrl: 'n' };
const prime = { name: 'Prime Video', logoUrl: 'p' };
const title = (name: string, genres: string[], services = [netflix], people: Person[] = []) => ({
	name,
	genres,
	services,
	stores: [] as string[],
	platforms: [] as string[],
	people
});
const game = (name: string, stores: string[], platforms: string[], genres: string[] = []) => ({
	...title(name, genres, []),
	stores,
	platforms
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
		expect(offered([title('Solo', [], [])])).toEqual({
			people: [],
			services: [],
			stores: [],
			platforms: [],
			genres: []
		});
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

	it('games: by store and platform, one fit within each, both together', () => {
		const games = [
			game('Hike', ['steam', 'gog'], ['Windows', 'Nintendo Switch'], ['Adventure']),
			game('Bot', ['playstation'], ['PlayStation 5']),
			game('Dredge', ['steam', 'nintendo'], ['Windows', 'Nintendo Switch', 'PlayStation 5'])
		];
		const left = (keys: string[]) => games.filter((g) => passes(g, keys)).map((g) => g.name);
		expect(left(['store:gog', 'store:playstation'])).toEqual(['Hike', 'Bot']);
		expect(left(['store:nintendo', 'platform:Nintendo Switch'])).toEqual(['Dredge']);
		expect(left(['platform:Nintendo Switch', 'genre:Adventure'])).toEqual(['Hike']);
		expect(countWith(games, ['store:steam'], 'platform:Windows')).toBe(2);

		const offer = offered(games);
		// Most titles first
		expect(offer.stores).toEqual(['steam', 'gog', 'playstation', 'nintendo']);
		expect(offer.platforms).toEqual(['Windows', 'Nintendo Switch', 'PlayStation 5']);
		expect(
			known(['store:steam', 'store:epic', 'platform:Windows', 'platform:Wii U'], offer)
		).toEqual(['store:steam', 'platform:Windows']);
	});

	it('store and platform go together: a store has to sell for the platform', () => {
		const games = [
			// On both consoles, in both console stores, and on Windows at Steam and GOG
			game(
				'Dredge',
				['steam', 'gog', 'playstation', 'xbox'],
				['Windows', 'PlayStation 5', 'Xbox One']
			),
			game('Bot', ['playstation'], ['PlayStation 5']),
			game('Linux game', ['epic', 'gog'], ['Windows', 'Linux'])
		];
		const left = (keys: string[]) => games.filter((g) => passes(g, keys)).map((g) => g.name);
		// The PlayStation Store does not sell for the Xbox
		expect(left(['store:playstation', 'platform:Xbox One'])).toEqual([]);
		expect(countWith(games, ['platform:Xbox One'], 'store:playstation')).toBe(0);
		expect(countWith(games, ['platform:Xbox One'], 'store:xbox')).toBe(1);
		// Several stores: one of them selling for one of the platforms is enough
		expect(left(['store:steam', 'store:gog', 'platform:Windows'])).toEqual([
			'Dredge',
			'Linux game'
		]);
		expect(left(['store:playstation', 'store:steam', 'platform:PlayStation 5'])).toEqual([
			'Dredge',
			'Bot'
		]);
		// Epic has no Linux games, although this game is at Epic and runs on Linux
		expect(left(['store:epic', 'platform:Linux'])).toEqual([]);
		expect(left(['store:gog', 'platform:Linux'])).toEqual(['Linux game']);
		// A store alone or a platform alone works as before
		expect(left(['store:playstation'])).toEqual(['Dredge', 'Bot']);
		expect(left(['platform:Windows'])).toEqual(['Dredge', 'Linux game']);
	});
});
