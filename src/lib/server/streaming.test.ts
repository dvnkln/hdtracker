import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from './db';
import { itemDetails, libraryItems, users } from './db/schema';
import { setUserSettings } from './settings';
import { hiddenServices, setServiceHidden, streamingOverview } from './streaming';
import { addItem, testUser } from '../../tests/helpers';
import type { Details } from './providers/types';

const offer = (name: string) => ({ name, logoUrl: `/${name}.png`, url: '' });

// Stored offers of a title: in a flat rate, and to rent and to buy
function offers(itemId: number, flatrate: string[], rent: string[] = [], buy: string[] = rent) {
	const info = {
		watch: { link: null, flatrate: flatrate.map(offer), rent: rent.map(offer), buy: buy.map(offer) }
	} as unknown as Details;
	getDb().insert(itemDetails).values({ itemId, info, show: null, fetchedAt: new Date() }).run();
}

// Every test starts with an empty library and no accounts (a deleted account takes its
// settings and memberships along).
beforeEach(() => {
	getDb().delete(libraryItems).run();
	getDb().delete(users).run();
});

const tiles = (overview: ReturnType<typeof streamingOverview>) =>
	overview.services.map((s) => [s.name, s.ids.length, s.purchase.length]);

describe('streamingOverview', () => {
	it('groups what one wants to watch by flat-rate service, A–Z or most titles first', () => {
		const a = addItem({ externalId: '1', status: 'planned' });
		const b = addItem({ category: 'series', externalId: '2', status: 'active' });
		const c = addItem({ category: 'anime', externalId: '3', status: 'paused' });
		offers(a.id, ['WOW']);
		offers(b.id, ['Netflix', 'WOW']);
		offers(c.id, ['Netflix', 'Crunchyroll']);
		const overview = streamingOverview(testUser());
		expect(tiles(overview)).toEqual([
			['Crunchyroll', 1, 0],
			['Netflix', 2, 0],
			['WOW', 2, 0]
		]);
		expect(overview.services[1]).toMatchObject({ logoUrl: '/Netflix.png', ids: [b.id, c.id] });
		// The order chosen on the page is remembered for the account
		setUserSettings(testUser(), { streamingOrder: 'count' });
		expect(tiles(streamingOverview(testUser())).map(([name]) => name)).toEqual([
			'Netflix',
			'WOW',
			'Crunchyroll'
		]);
		expect(overview.items.map((item) => item.id).sort()).toEqual([a.id, b.id, c.id].sort());
	});

	it('puts what is only to rent or buy with the streaming service the store belongs to', () => {
		// The Whale: rent at Amazon Video, Apple TV Store, Videoload – in no flat rate
		const whale = addItem({ externalId: '1' });
		offers(whale.id, [], ['Amazon Video', 'Apple TV Store', 'Videoload', 'Sky Store']);
		const overview = streamingOverview(testUser());
		// Amazon Video and the Apple TV Store with their services, the stores that only rent and
		// sell as tiles of their own – all in one list
		expect(tiles(overview)).toEqual([
			['Amazon Prime Video', 0, 1],
			['Apple TV', 0, 1],
			['Sky Store', 0, 1],
			['Videoload', 0, 1]
		]);
		expect(overview.items.map((item) => item.id)).toEqual([whale.id]);
	});

	it('names a service after its flat rate and counts a title once, in the flat rate first', () => {
		const a = addItem({ externalId: '1' });
		const b = addItem({ externalId: '2' });
		offers(a.id, ['Amazon Prime Video'], ['Amazon Video']);
		offers(b.id, [], ['Amazon Video'], ['Amazon Video']);
		const [prime] = streamingOverview(testUser()).services;
		expect(prime).toMatchObject({
			name: 'Amazon Prime Video',
			logoUrl: '/Amazon Prime Video.png',
			ids: [a.id],
			purchase: [b.id]
		});
	});

	it('takes a store that sells only for a service where it also streams in a flat rate', () => {
		const a = addItem({ externalId: '1' });
		const b = addItem({ externalId: '2' });
		offers(a.id, ['YouTube']);
		offers(b.id, [], ['YouTube', 'maxdome Store']);
		expect(tiles(streamingOverview(testUser()))).toEqual([
			['maxdome Store', 0, 1],
			['YouTube', 1, 1]
		]);
	});

	it('shows a title only to rent or buy at its stores, and leaves out what has no offer', () => {
		const rentOnly = addItem({ externalId: '1' });
		offers(rentOnly.id, [], ['Videoload', 'maxdome Store']);
		offers(addItem({ externalId: '2' }).id, []); // nowhere at all
		addItem({ externalId: '3' }); // details not stored yet
		const overview = streamingOverview(testUser());
		expect(overview.services.map((s) => [s.name, s.purchase])).toEqual([
			['maxdome Store', [rentOnly.id]],
			['Videoload', [rentOnly.id]]
		]);
		expect(overview.items.map((item) => item.id)).toEqual([rentOnly.id]);
	});

	it('leaves out watched and dropped titles, games and hidden areas', () => {
		const done = addItem({ externalId: '1', status: 'completed' });
		const dropped = addItem({ externalId: '2', status: 'dropped' });
		const game = addItem({ category: 'games', externalId: '3', status: 'active' });
		const anime = addItem({ category: 'anime', externalId: '4', status: 'planned' });
		for (const item of [done, dropped, game, anime]) offers(item.id, ['Netflix']);
		expect(tiles(streamingOverview(testUser()))).toEqual([['Netflix', 1, 0]]);

		setUserSettings(testUser(), { categories: 'movies,series,games' });
		expect(streamingOverview(testUser()).services).toEqual([]);
	});

	it('only shows the own library', () => {
		testUser();
		const ben = getDb()
			.insert(users)
			.values({ username: 'ben', passwordHash: 'x' })
			.returning()
			.get().id;
		offers(addItem({ externalId: '1', userId: ben }).id, ['Netflix']);
		expect(streamingOverview(testUser()).services).toEqual([]);
		expect(tiles(streamingOverview(ben))).toEqual([['Netflix', 1, 0]]);
	});

	it('remembers hidden services per account, and shows them again', () => {
		const anna = testUser();
		const ben = getDb()
			.insert(users)
			.values({ username: 'ben', passwordHash: 'x' })
			.returning()
			.get().id;
		expect(hiddenServices(anna)).toEqual([]);
		setServiceHidden(anna, 'videoload', true);
		setServiceHidden(anna, 'skystore', true);
		setServiceHidden(anna, 'videoload', true);
		expect(hiddenServices(anna)).toEqual(['skystore', 'videoload']);
		expect(hiddenServices(ben)).toEqual([]);
		setServiceHidden(anna, 'videoload', false);
		expect(hiddenServices(anna)).toEqual(['skystore']);
		// Whatever got into the setting, it reads as a list of keys
		setUserSettings(anna, { streamingHidden: 'not json' });
		expect(hiddenServices(anna)).toEqual([]);
		setUserSettings(anna, { streamingHidden: '[1, "netflix", null]' });
		expect(hiddenServices(anna)).toEqual(['netflix']);
	});
});
