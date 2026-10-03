import { describe, expect, it, vi } from 'vitest';
import { addItem, mockFetch } from '../../../tests/helpers';
import { getDb } from '../db';
import { libraryItems, watchedEpisodes } from '../db/schema';
import { exportYamtrack } from '../export/yamtrack';
import { clearLibrary } from '../library';
import { importYamtrack, parseCsv } from './yamtrack';

// The import starts loading details in the background afterwards – not part of these tests.
vi.mock('../releases', async (original) => ({
	...(await original<typeof import('../releases')>()),
	refreshPending: vi.fn()
}));

describe('parseCsv', () => {
	it('reads quoted fields with commas, quotes and line breaks', () => {
		expect(parseCsv('a,b\n"x, y","say ""hi"""\n"two\nlines",z\n')).toEqual([
			['a', 'b'],
			['x, y', 'say "hi"'],
			['two\nlines', 'z']
		]);
	});
});

// The library as plain data: title, status and watched episodes.
function snapshot() {
	const db = getDb();
	const episodes = db.select().from(watchedEpisodes).all();
	return db
		.select()
		.from(libraryItems)
		.all()
		.map((i) => ({
			category: i.category,
			source: i.source,
			externalId: i.externalId,
			status: i.status,
			watched: episodes
				.filter((e) => e.itemId === i.id)
				.map((e) => `S${e.season}E${e.episode}`)
				.sort()
		}))
		.sort((a, b) => `${a.category}${a.externalId}`.localeCompare(`${b.category}${b.externalId}`));
}

describe('export and import', () => {
	it('a library survives export -> empty -> import unchanged', async () => {
		const db = getDb();
		const watch = (itemId: number, season: number, numbers: number[]) =>
			db
				.insert(watchedEpisodes)
				.values(numbers.map((episode) => ({ itemId, season, episode })))
				.run();

		addItem({ category: 'movies', externalId: '603', title: 'The Matrix', status: 'completed' });
		addItem({
			category: 'movies',
			externalId: '604',
			title: 'Planned, "quoted"',
			status: 'planned'
		});
		const series = addItem({
			category: 'series',
			externalId: '1396',
			title: 'Series',
			status: 'active'
		});
		watch(series.id, 1, [1, 2, 3]);
		watch(series.id, 2, [1]);
		addItem({ category: 'series', externalId: '1399', title: 'Paused', status: 'paused' });
		const anime = addItem({
			category: 'anime',
			source: 'anilist',
			externalId: '5114',
			malId: 5114,
			title: 'Anime',
			status: 'active'
		});
		watch(anime.id, 1, [1, 2, 3, 4]);
		addItem({
			category: 'games',
			source: 'igdb',
			externalId: '72',
			title: 'Portal 2',
			status: 'dropped'
		});
		// Anime without a MyAnimeList ID cannot be exported.
		addItem({
			category: 'anime',
			source: 'anilist',
			externalId: '777',
			malId: null,
			title: 'No MAL'
		});

		const before = snapshot().filter((i) => i.externalId !== '777');
		const csv = exportYamtrack();
		clearLibrary('all');
		expect(snapshot()).toEqual([]);

		// The import looks up anime by their MyAnimeList ID at AniList.
		const calls = mockFetch({
			'graphql.anilist.co': {
				data: {
					Page: {
						media: [
							{
								id: 5114,
								idMal: 5114,
								title: { romaji: 'Anime', english: null },
								startDate: { year: 2009, month: 4, day: 5 },
								status: 'FINISHED',
								coverImage: { large: null },
								description: null
							}
						]
					}
				}
			}
		});
		const report = await importYamtrack(csv);

		expect(calls).toHaveLength(1);
		expect(report.imported).toEqual({ movies: 2, series: 2, anime: 1, games: 1 });
		expect(report.episodes).toBe(8);
		expect(report.skipped).toEqual([]);
		expect(snapshot()).toEqual(before);

		// A second import of the same file changes nothing.
		const again = await importYamtrack(csv);
		expect(again.existing).toBe(6);
		expect(snapshot()).toEqual(before);
	});

	it('skips entries hdtracker cannot track and says why', async () => {
		const csv =
			'"media_id","source","media_type","title","image","season_number","episode_number","score","status","notes","start_date","end_date","progress","created_at","progressed_at"\n' +
			'"1","manual","movie","Home video","","","","","Completed","","","","1","",""\n' +
			'"2","mangaupdates","manga","A manga","","","","","Planning","","","","0","",""\n';
		const report = await importYamtrack(csv);
		expect(report.skipped).toEqual([
			{ title: 'Home video', reason: 'manual' },
			{ title: 'A manga', reason: 'unsupported' }
		]);
	});
});
