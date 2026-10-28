import { describe, expect, it, vi } from 'vitest';
import { mockFetch } from '../../tests/helpers';
import { searchCategory, searchOrLast } from './search';

const reply = (id: number) => ({
	data: {
		Page: {
			media: [
				{
					id,
					idMal: null,
					title: { romaji: 'Test', english: 'Test' },
					startDate: { year: 2020, month: 1, day: 1 },
					status: 'FINISHED',
					coverImage: { large: null },
					description: null,
					format: 'TV',
					episodes: 12,
					season: 'WINTER',
					relations: { edges: [] }
				}
			]
		}
	}
});

describe('searchCategory', () => {
	it('asks the source once for the same search (the page asks again after each change)', async () => {
		const calls = mockFetch({ 'graphql.anilist.co': reply(1) });
		await searchCategory('anime', 'Frieren');
		const again = await searchCategory('anime', 'frieren');
		expect(again.map((h) => h.externalId)).toEqual(['1']);
		expect(calls).toHaveLength(1);
		// Another search asks
		await searchCategory('anime', 'Monster');
		expect(calls).toHaveLength(2);
	});

	it('does not keep a failed search', async () => {
		let fail = true;
		mockFetch({
			'graphql.anilist.co': () => (fail ? { data: null, errors: [{ message: 'down' }] } : reply(2))
		});
		await expect(searchCategory('anime', 'Mushishi')).rejects.toThrow();
		fail = false;
		expect((await searchCategory('anime', 'Mushishi')).map((h) => h.externalId)).toEqual(['2']);
	});

	it('keeps showing the last hits when the source fails later, and says why', async () => {
		let fail = false;
		mockFetch({
			'graphql.anilist.co': () => (fail ? { data: null, errors: [{ message: 'down' }] } : reply(3))
		});
		expect(await searchOrLast('anime', 'Naruto')).toEqual({
			hits: [expect.objectContaining({ externalId: '3' })],
			failed: null
		});
		// Later (no longer in the cache), the source fails: the last hits, with the reason
		fail = true;
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(Date.now() + 31 * 60_000);
		const later = await searchOrLast('anime', 'Naruto');
		vi.useRealTimers();
		expect(later.hits.map((h) => h.externalId)).toEqual(['3']);
		expect(later.failed).toBeInstanceOf(Error);
		// A search that never worked fails as before
		await expect(searchOrLast('anime', 'Bleach')).rejects.toThrow();
	});
});
