import { beforeEach, describe, expect, it } from 'vitest';
import { mockFetch } from '../../../tests/helpers';
import { getDb } from '../db';
import { animeTmdbMap } from '../db/schema';
import { setSettings } from '../settings';
import { animeTextsFor } from './animeEpisodes';
import { getAnimeDetails, getAnimeInfo } from './anilist';

// What TMDB answers for a show: seasons as { number: [first episode, count, first air date] }.
function tmdbShow(id: number, seasons: Record<number, [number, number, string]>) {
	const day = (start: string, offset: number) =>
		new Date(Date.parse(start) + offset * 7 * 86_400_000).toISOString().slice(0, 10);
	const show: Record<string, unknown> = {
		id,
		name: `Show ${id}`,
		original_name: `Show ${id}`,
		first_air_date: '2020-10-03',
		poster_path: null,
		overview: 'Text der Serie',
		status: 'Ended',
		seasons: Object.keys(seasons).map((n) => ({ season_number: Number(n) }))
	};
	for (const [n, [first, count, start]] of Object.entries(seasons)) {
		show[`season/${n}`] = {
			season_number: Number(n),
			name: `Staffel ${n}`,
			air_date: start,
			overview: `Text der Staffel ${n}`,
			episodes: Array.from({ length: count }, (_, i) => ({
				episode_number: first + i,
				name: `S${n} Folge ${first + i}`,
				air_date: day(start, i),
				overview: `Inhalt ${first + i}`,
				still_path: `/s${n}e${first + i}.jpg`,
				runtime: 24
			}))
		};
	}
	return show;
}

let nextId = 1000;
// A fresh AniList id with its rows in the mapping list.
function mapped(rows: [tmdbId: number, season: number, source: string, target: string][]) {
	const anilistId = nextId++;
	getDb()
		.insert(animeTmdbMap)
		.values(
			rows.map(([tmdbId, season, sourceRange, targetRange]) => ({
				anilistId,
				tmdbId,
				season,
				sourceRange,
				targetRange
			}))
		)
		.run();
	return String(anilistId);
}

beforeEach(() => setSettings({ animeEpisodeTitles: 'on', language: 'de-DE' }));

describe('animeTextsFor', () => {
	it('takes titles, texts and the season text of a matching season', async () => {
		const calls = mockFetch({ '/tv/501': tmdbShow(501, { 1: [1, 12, '2020-10-03'] }) });
		const id = mapped([[501, 1, '1-12', '1-12']]);
		const texts = await animeTextsFor(id, '2020-10-03', 12);
		expect(texts?.overview).toBe('Text der Staffel 1');
		expect(texts?.episodes.size).toBe(12);
		expect(texts?.episodes.get(3)).toEqual({
			title: 'S1 Folge 3',
			overview: 'Inhalt 3',
			stillUrl: 'https://image.tmdb.org/t/p/w300/s1e3.jpg',
			airDate: '2020-10-17',
			runtime: 24
		});
		expect(calls).toHaveLength(1);
		expect(calls[0]).toContain('language=de-DE');
	});

	it('picks the place whose first episode aired when the anime started', async () => {
		// Second season of the anime = episodes 25–47 of TMDB season 1; the list also offers a
		// season 2 that TMDB has for something else.
		mockFetch({
			'/tv/502': tmdbShow(502, { 1: [1, 47, '2020-10-03'], 2: [1, 23, '2026-01-10'] })
		});
		const id = mapped([
			[502, 2, '1-23', '1-23'],
			[502, 1, '1-23', '25-47']
		]);
		const texts = await animeTextsFor(id, '2021-03-20', 23);
		expect(texts?.episodes.get(1)?.title).toBe('S1 Folge 25');
		expect(texts?.episodes.get(23)?.title).toBe('S1 Folge 47');
		// Not the start of a TMDB season: no text of TMDB fits, the one of AniList stays
		expect(texts?.overview).toBeNull();
	});

	it('uses the text of the show only for its first season', async () => {
		const show = tmdbShow(511, { 1: [1, 12, '2020-10-03'], 2: [1, 12, '2021-10-02'] });
		for (const n of [1, 2]) (show[`season/${n}`] as { overview: string }).overview = '';
		mockFetch({ '/tv/511': show });
		const first = await animeTextsFor(mapped([[511, 1, '1-12', '1-12']]), '2020-10-03', 12);
		expect(first?.overview).toBe('Text der Serie');
		const second = await animeTextsFor(mapped([[511, 2, '1-12', '1-12']]), '2021-10-02', 12);
		expect(second?.overview).toBeNull();
		expect(second?.episodes.size).toBe(12);
	});

	it('accepts a start date that is up to two days off, not more', async () => {
		mockFetch({ '/tv/503': tmdbShow(503, { 1: [1, 12, '2020-10-03'] }) });
		const id = mapped([[503, 1, '1-12', '1-12']]);
		expect(await animeTextsFor(id, '2020-10-05', 12)).not.toBeNull();
		expect(await animeTextsFor(id, '2020-10-06', 12)).toBeNull();
		expect(await animeTextsFor(id, '2019-10-03', 12)).toBeNull();
		// Start date unknown: the episode only has to exist
		expect(await animeTextsFor(id, null, 12)).not.toBeNull();
	});

	it('refuses a season or episode TMDB does not have', async () => {
		mockFetch({ '/tv/504': tmdbShow(504, { 1: [1, 12, '2020-10-03'] }) });
		expect(await animeTextsFor(mapped([[504, 3, '1-12', '1-12']]), '2020-10-03', 12)).toBeNull();
		expect(await animeTextsFor(mapped([[504, 1, '1-12', '30-41']]), '2020-10-03', 12)).toBeNull();
	});

	it('follows an anime that is spread over several TMDB seasons', async () => {
		mockFetch({
			'/tv/505': tmdbShow(505, { 1: [1, 3, '2020-10-03'], 2: [4, 3, '2021-10-02'] })
		});
		const id = mapped([
			[505, 1, '1-3', '1-3'],
			[505, 2, '4-', '4-']
		]);
		const texts = await animeTextsFor(id, '2020-10-03', 8);
		expect(texts?.episodes.get(3)?.title).toBe('S1 Folge 3');
		expect(texts?.episodes.get(6)?.title).toBe('S2 Folge 6');
		// Episodes TMDB does not have yet simply stay without title
		expect(texts?.episodes.has(7)).toBe(false);
	});

	it('is nothing without mapping, with unsupported ranges or when TMDB fails', async () => {
		const calls = mockFetch({});
		expect(await animeTextsFor('999999', '2020-10-03', 12)).toBeNull();
		expect(await animeTextsFor(mapped([[506, 1, '1-12', '1-6|2']]), '2020-10-03', 12)).toBeNull();
		expect(calls).toHaveLength(0);
		// TMDB is asked and fails (mockFetch knows no answer)
		expect(await animeTextsFor(mapped([[507, 1, '1-12', '1-12']]), '2020-10-03', 12)).toBeNull();
	});

	it('asks nobody when the switch is off', async () => {
		const calls = mockFetch({ '/tv/508': tmdbShow(508, { 1: [1, 12, '2020-10-03'] }) });
		const id = mapped([[508, 1, '1-12', '1-12']]);
		setSettings({ animeEpisodeTitles: 'off' });
		expect(await animeTextsFor(id, '2020-10-03', 12)).toBeNull();
		expect(calls).toHaveLength(0);
	});
});

describe('an anime with texts from TMDB', () => {
	const anilist = (id: number, episodes: number) => ({
		data: {
			Page: {
				media: [
					{
						id,
						idMal: null,
						title: { romaji: 'Anime', english: 'Anime EN' },
						startDate: { year: 2020, month: 10, day: 3 },
						status: 'RELEASING',
						coverImage: { large: null },
						bannerImage: null,
						description: 'English text',
						genres: [],
						averageScore: null,
						format: 'TV',
						episodes,
						duration: 23,
						siteUrl: `https://anilist.co/anime/${id}`,
						nextAiringEpisode: { episode: 3, airingAt: Date.parse('2030-01-05T15:00:00Z') / 1000 },
						airingSchedule: {
							nodes: [{ episode: 3, airingAt: Date.parse('2030-01-05T15:00:00Z') / 1000 }]
						},
						studios: { nodes: [] },
						externalLinks: [],
						recommendations: { nodes: [] }
					}
				]
			},
			past: { pageInfo: { hasNextPage: false }, airingSchedules: [] }
		}
	});

	it('keeps title, progress and dates of AniList and adds the TMDB texts', async () => {
		const id = mapped([[509, 1, '1-4', '1-4']]);
		mockFetch({
			'graphql.anilist.co': anilist(Number(id), 4),
			'/tv/509': tmdbShow(509, { 1: [1, 3, '2020-10-03'] })
		});
		const show = await getAnimeDetails(id);
		expect(show.item.title).toBe('Anime EN');
		expect(show.item.overview).toBe('Text der Staffel 1');
		const [first, , third, fourth] = show.seasons[0].episodes;
		expect(first).toMatchObject({ title: 'S1 Folge 1', aired: true, airDate: '2020-10-03' });
		// Not aired yet according to AniList, whose date wins
		expect(third).toMatchObject({ title: 'S1 Folge 3', aired: false });
		expect(third.airDate).toMatch(/^2030-01-0[56]$/);
		// TMDB has no fourth episode yet
		expect(fourth).toMatchObject({ title: null, overview: null, stillUrl: null, runtime: 23 });

		expect((await getAnimeInfo(id)).item.overview).toBe('Text der Staffel 1');
	});

	it('stays as AniList has it when the mapping does not fit', async () => {
		const id = mapped([[510, 1, '1-4', '1-4']]);
		mockFetch({
			'graphql.anilist.co': anilist(Number(id), 4),
			'/tv/510': tmdbShow(510, { 1: [1, 4, '2015-04-01'] })
		});
		const show = await getAnimeDetails(id);
		expect(show.item.overview).toBe('English text');
		expect(show.seasons[0].episodes.every((e) => e.title === null)).toBe(true);
	});
});
