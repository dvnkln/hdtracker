import { beforeEach, describe, expect, it } from 'vitest';
import { addItem, mockFetch } from '../../tests/helpers';
import { announce, newSeasons } from './announcements';
import { getDb } from './db';
import { libraryItems, notices, notificationsSent, trackingMembers, users } from './db/schema';
import { findItem } from './library';
import { clearRead, listNotices } from './notices';
import { dueEvents, messagesFor } from './notifications';
import type { Details, ShowDetails } from './providers/types';
import { today } from './providers/types';
import { setUserSettings } from './settings';
import { withLocale } from './i18n';

// Only what newSeasons looks at
const show = (seasons: number[], airDate: string | null = null) =>
	({
		seasons: seasons.map((number) => ({
			number,
			name: `Season ${number}`,
			special: number === 0,
			airDate,
			episodes: []
		}))
	}) as unknown as ShowDetails;
const info = (links: [string, string, string | null][] | null) =>
	({
		anime: links && {
			format: 'TV',
			episodes: 12,
			season: null,
			start: '2020-01-01',
			links: links.map(([type, id, format]) => ({ type, id, format }))
		}
	}) as unknown as Details;
const NONE = {} as Details;

describe('newSeasons', () => {
	it('finds a season more of a series, with its start', () => {
		const before = { info: NONE, show: show([0, 1, 2]) };
		expect(newSeasons('series', before, NONE, show([0, 1, 2, 3], '2027-04-01'))).toEqual([
			{ kind: 'season', season: 3, date: '2027-04-01' }
		]);
		expect(newSeasons('series', before, NONE, show([0, 1, 2]))).toEqual([]);
	});

	it('finds a new sequel of an anime that is a season – not a film', () => {
		const before = { info: info([['SEQUEL', '2', 'TV']]), show: null };
		const after = info([
			['SEQUEL', '2', 'TV'],
			['SEQUEL', '3', 'TV'],
			['SEQUEL', '9', 'MOVIE'],
			['SIDE_STORY', '5', 'TV']
		]);
		expect(newSeasons('anime', before, after, null)).toEqual([{ kind: 'sequel', id: '3' }]);
	});

	it('announces nothing without a stored state (a new title, the first refresh after an update)', () => {
		expect(newSeasons('series', undefined, NONE, show([1, 2]))).toEqual([]);
		const old = { info: info(null), show: null };
		expect(newSeasons('anime', old, info([['SEQUEL', '3', 'TV']]), null)).toEqual([]);
	});
});

describe('announce', () => {
	let me: number;
	let friend: number;
	let gone: number;
	const user = (username: string) =>
		getDb().insert(users).values({ username, passwordHash: 'x' }).returning().get().id;
	const noticesOf = (userId: number) =>
		getDb()
			.select()
			.from(notices)
			.all()
			.filter((n) => n.userId === userId);

	beforeEach(() => {
		const db = getDb();
		for (const table of [notices, notificationsSent, trackingMembers, libraryItems, users]) {
			db.delete(table).run();
		}
		me = user('me');
		friend = user('friend');
		gone = user('gone');
		for (const id of [me, friend, gone]) {
			setUserSettings(id, {
				notifyMode: 'single',
				notifyHour: '0',
				notifyFrom: '',
				uiLanguage: 'en',
				categories: 'movies,series,anime,games'
			});
		}
	});

	it('tells those who have a series – not those who dropped or muted it', async () => {
		const mine = addItem({ category: 'series', externalId: '7', userId: me, status: 'active' });
		addItem({ category: 'series', externalId: '7', userId: friend, notify: false });
		addItem({ category: 'series', externalId: '7', userId: gone, status: 'dropped' });
		await announce(mine.id, [{ kind: 'season', season: 3, date: '2027-04-01' }]);
		expect(noticesOf(me).map((n) => [n.kind, n.season, n.date])).toEqual([
			['announced', 3, '2027-04-01']
		]);
		expect(noticesOf(friend)).toEqual([]);
		expect(noticesOf(gone)).toEqual([]);
		// In the inbox as one line
		expect(listNotices(me).map((line) => line.announced)).toEqual([
			{ season: 3, date: '2027-04-01' }
		]);
	});

	it('adds a new season of an anime as planned and tells about it', async () => {
		mockFetch({
			'graphql.anilist.co': {
				data: {
					Page: {
						media: [
							{
								id: 3,
								idMal: null,
								title: { romaji: 'Sanki', english: 'Anime Season 3' },
								startDate: { year: 2027, month: 4, day: 5 },
								status: 'NOT_YET_RELEASED',
								coverImage: { large: null },
								description: null,
								format: 'TV',
								episodes: null,
								season: 'SPRING',
								relations: { edges: [] }
							}
						]
					}
				}
			}
		});
		const s2 = addItem({ category: 'anime', externalId: '2', userId: me, status: 'completed' });
		addItem({ category: 'anime', externalId: '2', userId: friend, notify: false });
		addItem({ category: 'anime', externalId: '2', userId: gone, status: 'dropped' });
		expect(await announce(s2.id, [{ kind: 'sequel', id: '3' }])).toEqual(['3']);
		// Into the libraries of all who track it (muted too – muted only means no messages)
		expect(findItem(me, 'anime', '3')?.status).toBe('planned');
		expect(findItem(friend, 'anime', '3')?.status).toBe('planned');
		expect(findItem(gone, 'anime', '3')).toBeUndefined();
		// Muted stays muted
		expect(findItem(me, 'anime', '3')?.notify).toBe(true);
		expect(findItem(friend, 'anime', '3')?.notify).toBe(false);
		const s3 = findItem(me, 'anime', '3')!;
		expect(noticesOf(me).map((n) => [n.itemId, n.season, n.date])).toEqual([
			[s3.id, null, '2027-04-05']
		]);
		expect(noticesOf(friend)).toEqual([]);
	});

	it('adds the new season as one shared state for those who track together', async () => {
		mockFetch({
			'graphql.anilist.co': {
				data: {
					Page: {
						media: [
							{
								id: 3,
								idMal: null,
								title: { romaji: 'Sanki', english: 'Anime Season 3' },
								startDate: { year: 2027, month: 4, day: 5 },
								status: 'NOT_YET_RELEASED',
								coverImage: { large: null },
								description: null,
								format: 'TV',
								episodes: null,
								season: 'SPRING',
								relations: { edges: [] }
							}
						]
					}
				}
			}
		});
		const s2 = addItem({ category: 'anime', externalId: '2', userId: me, status: 'completed' });
		getDb()
			.insert(trackingMembers)
			.values({ trackingId: s2.trackingId, userId: friend, itemId: s2.id, addedAt: new Date() })
			.run();
		await announce(s2.id, [{ kind: 'sequel', id: '3' }]);
		const mine = findItem(me, 'anime', '3')!;
		const theirs = findItem(friend, 'anime', '3')!;
		expect(mine.status).toBe('planned');
		expect(theirs.trackingId).toBe(mine.trackingId);
	});

	it('is still pushed when the inbox was emptied before the hour', async () => {
		const mine = addItem({ category: 'series', externalId: '9', title: 'Show', userId: me });
		await announce(mine.id, [{ kind: 'season', season: 2, date: null }]);
		getDb().update(notices).set({ readAt: new Date() }).run();
		clearRead(me);
		// Gone from the inbox, but kept for the push
		expect(listNotices(me)).toEqual([]);
		expect(dueEvents(me, today()).map((d) => d.entry.title)).toEqual(['Show']);
	});

	it('is pushed like a release, once', async () => {
		const mine = addItem({
			category: 'series',
			externalId: '8',
			title: 'Long Show',
			userId: me,
			status: 'completed'
		});
		await announce(mine.id, [{ kind: 'season', season: 4, date: '2027-04-01' }]);
		const due = dueEvents(me, today());
		expect(due.map((d) => d.entry.title)).toEqual(['Long Show']);
		const [message] = withLocale('en', () => messagesFor(me, due, 'single'));
		expect(message.body).toBe('Season 4 announced · from Apr 1, 2027');
		// Marked as told once it went out: the sent marker
		getDb()
			.insert(notificationsSent)
			.values({
				userId: me,
				itemId: mine.id,
				kind: 'announced',
				season: 4,
				episode: 0,
				date: today()
			})
			.run();
		expect(dueEvents(me, today())).toEqual([]);
	});
});
