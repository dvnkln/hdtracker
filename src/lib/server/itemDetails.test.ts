import { describe, expect, it } from 'vitest';
import { addItem } from '../../tests/helpers';
import { animeFactsOf, saveDetails } from './itemDetails';
import type { Details } from './providers/types';

describe('animeFactsOf', () => {
	it('reads what an anime is and belongs with from its stored details – nothing for others', () => {
		const facts = {
			format: 'TV',
			episodes: 12,
			season: 'SPRING',
			start: '2016-04-03',
			links: [{ type: 'SEQUEL', id: '2', format: 'TV' }]
		};
		const anime = addItem({ category: 'anime', externalId: '1' });
		const movie = addItem({ category: 'movies', externalId: '9' });
		saveDetails(anime.id, { genres: ['Action'], anime: facts } as unknown as Details, null);
		saveDetails(movie.id, { genres: ['Drama'] } as unknown as Details, null);
		const read = animeFactsOf([anime.id, movie.id]);
		expect(read.get(anime.id)).toEqual(facts);
		expect(read.has(movie.id)).toBe(false);
	});
});
