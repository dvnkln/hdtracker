import { describe, expect, it } from 'vitest';
import { mockFetch } from '../../../tests/helpers';
import { recentFacts, searchAnime } from './anilist';

const media = {
	id: 20958,
	idMal: 25777,
	title: { romaji: 'Shingeki no Kyojin Season 2', english: 'Attack on Titan Season 2' },
	startDate: { year: 2017, month: 4, day: null },
	status: 'FINISHED',
	coverImage: { large: 'https://s4.anilist.co/file/aot2.jpg' },
	description: 'More titans.',
	format: 'TV',
	episodes: 12,
	season: 'SPRING',
	relations: {
		edges: [
			{ relationType: 'PREQUEL', node: { id: 16498, type: 'ANIME', format: 'TV' } },
			{ relationType: 'SEQUEL', node: { id: 99147, type: 'ANIME', format: 'TV' } },
			// The manga it is based on, and another work: not part of the series
			{ relationType: 'SOURCE', node: { id: 53390, type: 'MANGA' } },
			{ relationType: 'PREQUEL', node: { id: 1, type: 'MANGA' } },
			{ relationType: 'SPIN_OFF', node: { id: 21281, type: 'ANIME' } },
			{ relationType: 'CHARACTER', node: { id: 5, type: 'ANIME' } }
		]
	}
};

describe('searchAnime', () => {
	it('says what a hit is and which anime it belongs with', async () => {
		mockFetch({ 'graphql.anilist.co': { data: { Page: { media: [media] } } } });
		const [hit] = await searchAnime('attack on titan');
		expect(hit.anime).toEqual({
			format: 'TV',
			episodes: 12,
			season: 'SPRING',
			// Unknown day: sorts at the end of the month
			start: '2017-04-31',
			links: [
				{ type: 'PREQUEL', id: '16498', format: 'TV' },
				{ type: 'SEQUEL', id: '99147', format: 'TV' }
			]
		});
	});

	it('copes with missing fields', async () => {
		mockFetch({
			'graphql.anilist.co': {
				data: {
					Page: {
						media: [
							{
								...media,
								startDate: { year: null, month: null, day: null },
								format: null,
								episodes: null,
								season: null,
								relations: null
							}
						]
					}
				}
			}
		});
		const [hit] = await searchAnime('x');
		expect(hit.anime).toEqual({
			format: null,
			episodes: null,
			season: null,
			start: '9999-12-31',
			links: []
		});
	});

	it('keeps what it found for a while, for the library until the details are loaded', async () => {
		mockFetch({ 'graphql.anilist.co': { data: { Page: { media: [media] } } } });
		await searchAnime('attack on titan');
		const facts = await recentFacts(['20958', '1']);
		expect(facts.get('20958')?.format).toBe('TV');
		expect(facts.has('1')).toBe(false);
	});
});
