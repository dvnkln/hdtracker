import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from './db';
import { itemDetails, libraryItems, users } from './db/schema';
import { setUserSettings } from './settings';
import { streamingOverview } from './streaming';
import { addItem, testUser } from '../../tests/helpers';
import type { Details } from './providers/types';

function offers(itemId: number, ...names: string[]) {
	const info = {
		watch: {
			link: null,
			flatrate: names.map((name) => ({ name, logoUrl: `/${name}.png`, url: '' })),
			rent: [{ name: 'Amazon Video', logoUrl: '/av.png', url: '' }],
			buy: []
		}
	} as unknown as Details;
	getDb().insert(itemDetails).values({ itemId, info, show: null, fetchedAt: new Date() }).run();
}

// Every test starts with an empty library and no accounts (a deleted account takes its
// settings and memberships along).
beforeEach(() => {
	getDb().delete(libraryItems).run();
	getDb().delete(users).run();
});

const named = (overview: ReturnType<typeof streamingOverview>) =>
	overview.services.map((s) => [s.name, s.ids.length]);

describe('streamingOverview', () => {
	it('groups what one wants to watch by flat-rate service, most titles first', () => {
		const a = addItem({ externalId: '1', status: 'planned' });
		const b = addItem({ category: 'series', externalId: '2', status: 'active' });
		const c = addItem({ category: 'anime', externalId: '3', status: 'paused' });
		offers(a.id, 'WOW');
		offers(b.id, 'Netflix', 'WOW');
		offers(c.id, 'Netflix', 'Crunchyroll');
		const overview = streamingOverview(testUser());
		expect(named(overview)).toEqual([
			['Netflix', 2],
			['WOW', 2],
			['Crunchyroll', 1]
		]);
		expect(overview.services[0]).toMatchObject({ logoUrl: '/Netflix.png', ids: [b.id, c.id] });
		expect(overview.items.map((item) => item.id).sort()).toEqual([a.id, b.id, c.id].sort());
	});

	it('leaves out watched and dropped titles, games and hidden areas', () => {
		const done = addItem({ externalId: '1', status: 'completed' });
		const dropped = addItem({ externalId: '2', status: 'dropped' });
		const game = addItem({ category: 'games', externalId: '3', status: 'active' });
		const anime = addItem({ category: 'anime', externalId: '4', status: 'planned' });
		for (const item of [done, dropped, game, anime]) offers(item.id, 'Netflix');
		expect(named(streamingOverview(testUser()))).toEqual([['Netflix', 1]]);

		setUserSettings(testUser(), { categories: 'movies,series,games' });
		expect(streamingOverview(testUser()).services).toEqual([]);
	});

	it('lists released titles without a flat rate as nowhere, not what is still to come', () => {
		const loaded = new Date(); // (still loading would count as out)
		const rentOnly = addItem({
			externalId: '1',
			releaseDate: '2020-01-01',
			metadataUpdatedAt: loaded
		});
		const future = addItem({
			externalId: '2',
			releaseDate: '2999-01-01',
			metadataUpdatedAt: loaded
		});
		offers(rentOnly.id);
		offers(future.id);
		const overview = streamingOverview(testUser());
		expect(overview.nowhere).toEqual([rentOnly.id]);
		expect(overview.items.map((item) => item.id)).toEqual([rentOnly.id]);
	});

	it('leaves out titles whose details are not stored yet', () => {
		addItem({ externalId: '1', releaseDate: '2020-01-01' });
		expect(streamingOverview(testUser())).toEqual({ items: [], services: [], nowhere: [] });
	});

	it('only shows the own library', () => {
		testUser();
		const ben = getDb()
			.insert(users)
			.values({ username: 'ben', passwordHash: 'x' })
			.returning()
			.get().id;
		offers(addItem({ externalId: '1', userId: ben }).id, 'Netflix');
		expect(streamingOverview(testUser()).services).toEqual([]);
		expect(named(streamingOverview(ben))).toEqual([['Netflix', 1]]);
	});
});
