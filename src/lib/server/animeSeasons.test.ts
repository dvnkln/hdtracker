import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addItem, mockFetch, testUser } from '../../tests/helpers';
import { trackSeries } from './animeSeasons';
import { clearLibrary, findItem, listLibrary } from './library';
import { searchAnime } from './providers/anilist';
import { forgetRateLimits } from './providers/types';

// A series at "AniList": three seasons with a film between season 2 and 3 (linked through it,
// as AniList links Demon Slayer's Mugen Train), plus an OVA on the side.
type Link = [string, number];
function media(id: number, format: string, year: number, links: Link[]) {
	return {
		id,
		idMal: null,
		title: { romaji: `Romaji ${id}`, english: `Anime ${id}` },
		startDate: { year, month: 4, day: 1 },
		status: 'FINISHED',
		coverImage: { large: null },
		description: null,
		format,
		episodes: 12,
		season: 'SPRING',
		relations: {
			edges: links.map(([relationType, to]) => ({
				relationType,
				node: { id: to, type: 'ANIME', format: null }
			}))
		}
	};
}
const ANILIST = [
	media(1, 'TV', 2016, [['SEQUEL', 2]]),
	media(2, 'TV', 2017, [
		['PREQUEL', 1],
		['SEQUEL', 9],
		['SIDE_STORY', 5]
	]),
	media(9, 'MOVIE', 2018, [
		['PREQUEL', 2],
		['SEQUEL', 3]
	]),
	media(3, 'TV', 2019, [['PREQUEL', 9]]),
	media(5, 'OVA', 2017, [['PARENT', 2]])
];

function anilist() {
	return mockFetch({
		'graphql.anilist.co': (_url: string, body: string) => {
			const { query, variables } = JSON.parse(body);
			// Only the chain is answered here; loading details for the episodes fails (and is
			// allowed to: the seasons are added anyway)
			if (query.includes('past:')) return { data: null, errors: [{ message: 'not here' }] };
			return {
				data: { Page: { media: ANILIST.filter((m) => variables.ids.includes(m.id)) } }
			};
		}
	});
}

const statusOf = (id: string) => findItem(testUser(), 'anime', id)?.status ?? null;

// Work in the background waits between requests (several seconds at AniList): let the time pass.
async function finish<T>(promise: Promise<T>) {
	let settled = false;
	void promise.finally(() => (settled = true));
	for (let i = 0; i < 30 && !settled; i++) await vi.advanceTimersByTimeAsync(4000);
	return promise;
}
// What tracking a season added, once it is all done (also what went to the background)
async function track(externalId: string, status: Parameters<typeof trackSeries>[2]) {
	const { done } = await trackSeries(testUser(), externalId, status);
	const result = await finish(done);
	await finish(result.ticked);
	return result.added;
}

describe('tracking a season tracks the series', () => {
	beforeEach(() => {
		clearLibrary(testUser(), 'all');
		forgetRateLimits();
		vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
	});
	afterEach(() => vi.useRealTimers());

	it('adds the earlier seasons as watched and the later ones as planned', async () => {
		anilist();
		addItem({ category: 'anime', externalId: '2', status: 'active' });
		// Not known from a search: nothing at once, the rest in the background
		const now = await trackSeries(testUser(), '2', 'active');
		expect(now.added).toEqual([]);
		const later = await finish(now.done);
		await finish(later.ticked);
		expect(later.added).toEqual([
			{ externalId: '1', status: 'completed' },
			{ externalId: '3', status: 'planned' }
		]);
		expect([statusOf('1'), statusOf('2'), statusOf('3')]).toEqual([
			'completed',
			'active',
			'planned'
		]);
		// The film and the OVA do not come along
		expect([statusOf('9'), statusOf('5')]).toEqual([null, null]);
		expect(findItem(testUser(), 'anime', '1')?.title).toBe('Anime 1');
	});

	it('leaves what is in the library already as it is', async () => {
		anilist();
		addItem({ category: 'anime', externalId: '3', status: 'dropped' });
		addItem({ category: 'anime', externalId: '1', status: 'planned' });
		await track('1', 'planned');
		expect([statusOf('1'), statusOf('2'), statusOf('3')]).toEqual([
			'planned',
			'planned',
			'dropped'
		]);
	});

	it('brings nothing for a dropped season, a film or an OVA', async () => {
		const calls = anilist();
		expect(await track('2', 'dropped')).toEqual([]);
		expect(calls).toHaveLength(0);
		expect(await track('9', 'active')).toEqual([]);
		expect(await track('5', 'active')).toEqual([]);
		expect(listLibrary(testUser(), 'anime')).toHaveLength(0);
	});

	it('brings the earlier seasons as planned when a later one is planned', async () => {
		anilist();
		addItem({ category: 'anime', externalId: '3', status: 'planned' });
		expect(await track('3', 'planned')).toEqual([
			{ externalId: '1', status: 'planned' },
			{ externalId: '2', status: 'planned' }
		]);
	});

	it('asks nothing more when a search just found all seasons', async () => {
		const asked: string[] = [];
		mockFetch({
			'graphql.anilist.co': (_url: string, body: string) => {
				const { query } = JSON.parse(body);
				asked.push(
					query.includes('search:') ? 'search' : query.includes('past:') ? 'details' : 'chain'
				);
				if (query.includes('past:')) return { data: null, errors: [{ message: 'not here' }] };
				return { data: { Page: { media: ANILIST } } };
			}
		});
		await searchAnime('anime');
		addItem({ category: 'anime', externalId: '3', status: 'active' });
		// Known from the search: at once, not in the background
		const { added } = await trackSeries(testUser(), '3', 'active');
		expect(added.map((a) => a.externalId)).toEqual(['1', '2']);
		// The chain was not asked for (only the episodes of the watched ones are loaded)
		expect(asked.filter((what) => what === 'chain')).toEqual([]);
	});
});
