import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { addItem, mockFetch } from '../../tests/helpers';
import { getDb } from './db';
import { itemDetails, libraryItems, releases } from './db/schema';
import { isDue, refreshBatch } from './releases';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('isDue: how often the nightly refresh asks for a title', () => {
	const now = Date.now();
	const item = (values: Parameters<typeof addItem>[0], daysAgo: number | null) => ({
		...addItem({ externalId: String(Math.random()), ...values }),
		metadataUpdatedAt: daysAgo === null ? null : new Date(now - daysAgo * DAY)
	});

	it('never loaded: always', () => {
		expect(isDue(item({ status: 'completed' }, null), false, now)).toBe(true);
	});
	it('planned, watching and paused: every night', () => {
		for (const status of ['planned', 'active', 'paused'] as const) {
			expect(isDue(item({ category: 'series', status }, 1), true, now)).toBe(true);
		}
	});
	it('a watched series that still runs: every night', () => {
		expect(isDue(item({ category: 'series', status: 'completed' }, 1), false, now)).toBe(true);
	});
	it('a watched series that has ended: once a week', () => {
		const series = { category: 'series', status: 'completed' } as const;
		expect(isDue(item(series, 1), true, now)).toBe(false);
		expect(isDue(item(series, 6), true, now)).toBe(false);
		expect(isDue(item(series, 7), true, now)).toBe(true);
	});
	it('watched movies and anime, finished games: once a week', () => {
		for (const category of ['movies', 'anime', 'games'] as const) {
			expect(isDue(item({ category, status: 'completed' }, 3), false, now)).toBe(false);
			expect(isDue(item({ category, status: 'completed' }, 7), false, now)).toBe(true);
		}
	});
	it('dropped: once a month', () => {
		expect(isDue(item({ status: 'dropped' }, 29), false, now)).toBe(false);
		expect(isDue(item({ status: 'dropped' }, 30), false, now)).toBe(true);
	});
});

// What AniList answers for one anime (only what the app reads).
const anime = (id: number) => ({
	id,
	idMal: id + 1000,
	title: { romaji: `Anime ${id}`, english: null },
	startDate: { year: 2020, month: 1, day: 5 },
	status: 'FINISHED',
	coverImage: { large: null },
	bannerImage: null,
	description: 'About <i>it</i>',
	genres: ['Action'],
	averageScore: 80,
	format: 'TV',
	episodes: 12,
	duration: 24,
	siteUrl: `https://anilist.co/anime/${id}`,
	nextAiringEpisode: null,
	airingSchedule: { nodes: [] },
	studios: { nodes: [] },
	externalLinks: [],
	recommendations: { nodes: [] }
});

describe('refreshBatch', () => {
	it('loads many anime with one request; an unknown one does not stop the others', async () => {
		const items = ['11', '12', '99999999'].map((externalId) =>
			addItem({ category: 'anime', source: 'anilist', externalId })
		);
		const calls = mockFetch({
			'graphql.anilist.co': (_url: string, body: string) => {
				const ids: number[] = JSON.parse(body).variables.ids;
				return {
					data: {
						Page: { media: ids.filter((id) => id < 1000).map(anime) },
						past: { pageInfo: { hasNextPage: false }, airingSchedules: [] }
					}
				};
			}
		});

		const result = await refreshBatch('anilist', items);

		// One request for all three, one more for the unknown anime asking for itself.
		expect(calls).toHaveLength(2);
		expect(result.stopped).toBe(false);
		// A title the source does not know is not a failure: it is marked and left alone.
		expect(result.failed).toEqual([]);
		const gone = getDb().select().from(libraryItems).where(eq(libraryItems.id, items[2].id)).get()!;
		expect(gone.sourceMissingSince).not.toBeNull();
		expect(gone.metadataUpdatedAt).not.toBeNull();
		expect(isDue(gone, false, Date.now())).toBe(false);
		expect(isDue(gone, false, Date.now() + 31 * DAY)).toBe(true);

		const db = getDb();
		const saved = db.select().from(libraryItems).where(eq(libraryItems.id, items[0].id)).get()!;
		expect(saved.title).toBe('Anime 11');
		expect(saved.malId).toBe(1011);
		expect(saved.overview).toBe('About it');
		expect(saved.metadataUpdatedAt).not.toBeNull();
		const details = db.select().from(itemDetails).where(eq(itemDetails.itemId, items[1].id)).get()!;
		expect(details.show?.seasons[0].episodes).toHaveLength(12);
		expect(db.select().from(releases).where(eq(releases.itemId, items[0].id)).all()).toEqual([]);
	});

	it('a title that is found again loses its mark', async () => {
		const item = addItem({
			category: 'anime',
			source: 'anilist',
			externalId: '31',
			sourceMissingSince: new Date()
		});
		mockFetch({
			'graphql.anilist.co': {
				data: {
					Page: { media: [anime(31)] },
					past: { pageInfo: { hasNextPage: false }, airingSchedules: [] }
				}
			}
		});
		await refreshBatch('anilist', [item]);
		const saved = getDb().select().from(libraryItems).where(eq(libraryItems.id, item.id)).get()!;
		expect(saved.sourceMissingSince).toBeNull();
		expect(saved.title).toBe('Anime 31');
	});

	it('gives up on the whole batch when the service keeps answering "too many requests"', async () => {
		const items = ['21', '22'].map((externalId) =>
			addItem({ category: 'anime', source: 'anilist', externalId })
		);
		vi.mocked(fetch).mockImplementation(async () => new Response('slow down', { status: 429 }));
		const result = await refreshBatch('anilist', items);
		expect(result.stopped).toBe(true);
		expect(result.failed).toHaveLength(2);
	});
});
