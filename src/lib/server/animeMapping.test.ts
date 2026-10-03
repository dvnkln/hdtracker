import { zstdCompressSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import {
	MAPPING_URL,
	composeRanges,
	ensureAnimeMapping,
	mappingFor,
	parseRange,
	rowsOf,
	tmdbEpisodesFor,
	updateAnimeMapping
} from './animeMapping';
import { getSetting, setSettings } from './settings';

describe('parseRange', () => {
	it('reads closed, open and single ranges', () => {
		expect(parseRange('1-23')).toEqual({ from: 1, to: 23 });
		expect(parseRange('14-')).toEqual({ from: 14, to: null });
		expect(parseRange('7')).toEqual({ from: 7, to: 7 });
	});
	it('refuses what it does not support or understand', () => {
		for (const text of ['1-6,8-13', '14-|2', '', 'x', '0-3', '5-2']) {
			expect(parseRange(text), text).toBeNull();
		}
	});
});

describe('tmdbEpisodesFor', () => {
	const row = (season: number, sourceRange: string, targetRange: string) => ({
		tmdbId: 95479,
		season,
		sourceRange,
		targetRange
	});
	const place = (season: number, episode: number) => ({ tmdbId: 95479, season, episode });

	it('same numbers on both sides', () => {
		expect(tmdbEpisodesFor([row(1, '1-24', '1-24')], 5)).toEqual([place(1, 5)]);
		expect(tmdbEpisodesFor([row(1, '1-24', '1-24')], 25)).toEqual([]);
	});
	it('a later season that continues the numbering at TMDB', () => {
		const rows = [row(1, '1-23', '25-47')];
		expect(tmdbEpisodesFor(rows, 1)).toEqual([place(1, 25)]);
		expect(tmdbEpisodesFor(rows, 23)).toEqual([place(1, 47)]);
	});
	it('open end', () => {
		expect(tmdbEpisodesFor([row(2, '1-', '41-')], 12)).toEqual([place(2, 52)]);
	});
	it('one AniList entry spread over several TMDB seasons', () => {
		const rows = [row(1, '1-62', '1-62'), row(2, '63-136', '63-136')];
		expect(tmdbEpisodesFor(rows, 62)).toEqual([place(1, 62)]);
		expect(tmdbEpisodesFor(rows, 63)).toEqual([place(2, 63)]);
	});
	it('offers every place the list names for an episode', () => {
		const rows = [row(1, '1-23', '25-47'), row(2, '1-23', '1-23')];
		expect(tmdbEpisodesFor(rows, 3)).toEqual([place(1, 27), place(2, 3)]);
	});
	it('skips ranges it does not support', () => {
		expect(tmdbEpisodesFor([row(1, '1-12', '1-6,8-13')], 3)).toEqual([]);
	});
});

describe('composeRanges', () => {
	const both = (sourceRange: string, targetRange: string) => ({ sourceRange, targetRange });
	it('same numbers all the way', () => {
		expect(composeRanges('1-12', '1-12', '1-12', '1-12')).toEqual(both('1-12', '1-12'));
	});
	it('shifts on both steps', () => {
		// Anime 1–10 = TVDB season 2, 1–10 = TMDB season 1, 29–38
		expect(composeRanges('1-10', '1-10', '1-10', '29-38')).toEqual(both('1-10', '29-38'));
		// Anime 1–12 = TVDB 13–24; TVDB 1–24 = TMDB 101–124
		expect(composeRanges('1-12', '13-24', '1-24', '101-124')).toEqual(both('1-12', '113-124'));
	});
	it('keeps only the part both steps cover', () => {
		expect(composeRanges('1-24', '1-24', '13-24', '1-12')).toEqual(both('13-24', '1-12'));
		expect(composeRanges('1-12', '1-12', '13-24', '1-12')).toBeNull();
	});
	it('open ends and single episodes', () => {
		expect(composeRanges('1-', '5-', '1-', '1-')).toEqual(both('1-', '5-'));
		expect(composeRanges('1-', '1-', '1-12', '1-12')).toEqual(both('1-12', '1-12'));
		expect(composeRanges('3', '7', '1-12', '1-12')).toEqual(both('3', '7'));
	});
	it('refuses ranges it does not support', () => {
		expect(composeRanges('1-12', '1-6|2', '1-6', '1-6')).toBeNull();
	});
});

const FILE = {
	$meta: { schema_version: '3.0.3' },
	'anilist:145064': {
		'mal:51009': { '1-23': '1-23' },
		'tmdb_show:95479:s1': { '1-23': '25-47' },
		'tvdb_show:377543:s2': { '1-23': '1-23' }
	},
	'anilist:11061': {
		'tmdb_show:46298:s1': { '1-62': '1-62' },
		'tmdb_show:46298:s2': { '63-136': '63-136' }
	},
	'anilist:999': { 'tmdb_movie:5': { '1': '1' } },
	// Only known at TVDB; the list knows the TMDB season of that TVDB season
	'anilist:171018': { 'mal:57334': { '1-12': '1-12' }, 'tvdb_show:432832:s1': { '1-12': '1-12' } },
	'tvdb_show:432832:s1': {
		'anilist:171018': { '1-12': '1-12' },
		'tmdb_show:240411:s1': { '1-12': '1-12' }
	},
	// Known at TVDB only, and nobody knows the TMDB season: nothing
	'anilist:5': { 'tvdb_show:1:s1': { '1-12': '1-12' } },
	'tmdb_show:95479:s1': { 'anilist:145064': { '25-47': '1-23' } }
};
const answerWithList = () =>
	vi
		.mocked(fetch)
		.mockImplementation(async () => new Response(zstdCompressSync(JSON.stringify(FILE))));

describe('the mapping list', () => {
	it('keeps only AniList entries that point to a TMDB show', () => {
		expect(rowsOf(FILE as never)).toEqual([
			{ anilistId: 145064, tmdbId: 95479, season: 1, sourceRange: '1-23', targetRange: '25-47' },
			{ anilistId: 11061, tmdbId: 46298, season: 1, sourceRange: '1-62', targetRange: '1-62' },
			{ anilistId: 11061, tmdbId: 46298, season: 2, sourceRange: '63-136', targetRange: '63-136' },
			{ anilistId: 171018, tmdbId: 240411, season: 1, sourceRange: '1-12', targetRange: '1-12' }
		]);
	});

	it('is downloaded, unpacked and stored; a second download replaces it', async () => {
		answerWithList();
		expect(await updateAnimeMapping()).toBe(4);
		expect(vi.mocked(fetch).mock.calls[0][0]).toBe(MAPPING_URL);
		expect(mappingFor('11061')).toHaveLength(2);
		expect(mappingFor('145064')[0]).toMatchObject({ tmdbId: 95479, season: 1 });
		expect(mappingFor('1')).toEqual([]);

		answerWithList();
		await updateAnimeMapping();
		expect(mappingFor('11061')).toHaveLength(2);
	});

	it('a failed download keeps the old list', async () => {
		vi.mocked(fetch).mockImplementation(async () => new Response('gone', { status: 404 }));
		await expect(updateAnimeMapping()).rejects.toThrow();
		expect(mappingFor('11061')).toHaveLength(2);
	});

	it('is only fetched when it is older than a week and the feature is on', async () => {
		answerWithList();
		setSettings({ animeMappingAt: new Date().toISOString() });
		await ensureAnimeMapping();
		expect(fetch).not.toHaveBeenCalled();

		setSettings({ animeMappingAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() });
		setSettings({ animeEpisodeTitles: 'off' });
		await ensureAnimeMapping();
		expect(fetch).not.toHaveBeenCalled();

		setSettings({ animeEpisodeTitles: 'on' });
		await ensureAnimeMapping();
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(Date.now() - Date.parse(getSetting('animeMappingAt'))).toBeLessThan(60_000);
	});
});
