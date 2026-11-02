import { describe, expect, it } from 'vitest';
import { movieInRegion, type TmdbMovieFull } from './tmdb';

// Only what movieInRegion() reads
const movie = (
	releaseDate: string,
	dates: { country: string; type: number; date: string }[]
): TmdbMovieFull =>
	({
		id: 1,
		title: 'Some Movie',
		original_title: 'Some Movie',
		release_date: releaseDate,
		poster_path: null,
		overview: '',
		release_dates: {
			results: [...new Set(dates.map((d) => d.country))].map((country) => ({
				iso_3166_1: country,
				release_dates: dates
					.filter((d) => d.country === country)
					.map((d) => ({ type: d.type, release_date: `${d.date}T00:00:00.000Z` }))
			}))
		}
	}) as unknown as TmdbMovieFull;

describe('when a movie is out in the region', () => {
	it('takes the cinema start in the region, not the premiere elsewhere', () => {
		const m = movie('2025-11-20', [
			{ country: 'US', type: 3, date: '2025-11-20' },
			{ country: 'DE', type: 3, date: '2026-01-08' }
		]);
		expect(movieInRegion(m, 'DE').item.releaseDate).toBe('2026-01-08');
		expect(movieInRegion(m, 'US').item.releaseDate).toBe('2025-11-20');
	});

	it('takes whatever came first in the region: cinema or at home', () => {
		const m = movie('2025-03-01', [
			{ country: 'DE', type: 3, date: '2025-09-01' },
			{ country: 'DE', type: 4, date: '2025-06-15' }
		]);
		expect(movieInRegion(m, 'DE').item.releaseDate).toBe('2025-06-15');
	});

	it('leaves out a festival premiere and TV in the region', () => {
		const m = movie('2025-05-20', [
			{ country: 'DE', type: 1, date: '2025-05-20' },
			{ country: 'DE', type: 6, date: '2025-07-01' },
			{ country: 'DE', type: 3, date: '2025-10-02' }
		]);
		expect(movieInRegion(m, 'DE').item.releaseDate).toBe('2025-10-02');
	});

	it('without dates for the region: the general release date', () => {
		const m = movie('2025-05-20', [{ country: 'US', type: 3, date: '2025-05-20' }]);
		expect(movieInRegion(m, 'DE').item.releaseDate).toBe('2025-05-20');
		expect(movieInRegion(movie('', []), 'DE').item.releaseDate).toBeNull();
	});

	it('keeps the general year', () => {
		const m = movie('2025-11-20', [{ country: 'DE', type: 3, date: '2026-01-08' }]);
		expect(movieInRegion(m, 'DE').item.year).toBe(2025);
	});

	it('an old movie with only a re-release in the region stays out', () => {
		const m = movie('1999-06-01', [
			{ country: 'DE', type: 5, date: '2026-12-01' },
			{ country: 'DE', type: 3, date: '2026-12-24' }
		]);
		expect(movieInRegion(m, 'DE').item.releaseDate).toBe('1999-06-01');
		// A start in the region within a year still counts
		const late = movie('2025-11-20', [{ country: 'DE', type: 3, date: '2026-11-19' }]);
		expect(movieInRegion(late, 'DE').item.releaseDate).toBe('2026-11-19');
	});
});
