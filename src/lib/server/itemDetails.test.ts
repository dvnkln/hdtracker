import { describe, expect, it, vi } from 'vitest';
import { addItem } from '../../tests/helpers';
import { getDetails } from './details';
import { animeFactsOf, detailsOrLast, saveDetails } from './itemDetails';
import { ProviderError, type Details } from './providers/types';

vi.mock('./details', () => ({ getDetails: vi.fn() }));

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

describe('detailsOrLast', () => {
	const movie = (title: string) => ({ item: { title } }) as unknown as Details;

	it('keeps showing the last details when the source fails on asking again', async () => {
		vi.mocked(getDetails).mockResolvedValueOnce(movie('Dune'));
		expect(await detailsOrLast('movies', '438631')).toMatchObject({
			info: { item: { title: 'Dune' } },
			failed: null
		});
		const down = new ProviderError('TMDB responded with error 503.', 503);
		vi.mocked(getDetails).mockRejectedValueOnce(down);
		expect(await detailsOrLast('movies', '438631')).toMatchObject({
			info: { item: { title: 'Dune' } },
			failed: down
		});
	});

	it('fails as before for a page never shown, and when the source says "not found"', async () => {
		vi.mocked(getDetails).mockRejectedValueOnce(new ProviderError('down', 503));
		await expect(detailsOrLast('movies', '1')).rejects.toThrow('down');
		vi.mocked(getDetails).mockResolvedValueOnce(movie('Gone'));
		await detailsOrLast('movies', '2');
		vi.mocked(getDetails).mockRejectedValueOnce(new ProviderError('not found', 404));
		await expect(detailsOrLast('movies', '2')).rejects.toThrow('not found');
	});
});
