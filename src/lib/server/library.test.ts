import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { addItem } from '../../tests/helpers';
import { getDashboard } from './dashboard';
import { getDb } from './db';
import {
	itemDetails,
	libraryItems,
	releases,
	trackingMembers,
	trackings,
	users,
	watchedEpisodes
} from './db/schema';
import { setEpisodes, watchedKeys } from './episodes';
import {
	allItems,
	clearLibrary,
	countByCategory,
	findItem,
	findTitle,
	libraryStatusFor,
	listLibrary,
	removeItem,
	saveItem,
	setNotify
} from './library';
import type { SearchResult, ShowDetails } from './providers/types';
import { busiestStatus } from './releases';

// Adding a title starts loading its details in the background – not part of these tests.
vi.mock('./releases', async (original) => ({
	...(await original<typeof import('./releases')>()),
	refreshPending: vi.fn()
}));

const movie = (externalId: string, title = 'Movie'): SearchResult => ({
	source: 'tmdb',
	externalId,
	title,
	originalTitle: null,
	year: 2020,
	releaseDate: '2020-01-01',
	earlyAccess: false,
	malId: null,
	posterUrl: null,
	overview: null
});
// A series with three aired episodes, still running
const show = (externalId: string): ShowDetails =>
	({
		item: { ...movie(externalId, 'Show') },
		ended: false,
		seasons: [
			{
				number: 1,
				special: false,
				episodes: [1, 2, 3].map((number) => ({ number, aired: true }))
			}
		]
	}) as unknown as ShowDetails;

let anna: number;
let ben: number;
const count = (table: typeof libraryItems | typeof trackings | typeof trackingMembers) =>
	getDb().select().from(table).all().length;

beforeEach(() => {
	const db = getDb();
	db.delete(libraryItems).run();
	db.delete(users).run();
	const user = (username: string) =>
		db.insert(users).values({ username, passwordHash: 'x' }).returning().get().id;
	anna = user('anna');
	ben = user('ben');
});

describe('every user has a library of their own', () => {
	it('a title two users track is stored once, with a state for each', () => {
		saveItem(anna, 'movies', movie('1'), 'planned');
		saveItem(ben, 'movies', movie('1'), 'completed');
		expect(count(libraryItems)).toBe(1);
		expect(count(trackings)).toBe(2);
		expect(findItem(anna, 'movies', '1')?.status).toBe('planned');
		expect(findItem(ben, 'movies', '1')?.status).toBe('completed');
	});

	it('changing the status changes it for oneself only', () => {
		saveItem(anna, 'movies', movie('1'), 'planned');
		saveItem(ben, 'movies', movie('1'), 'planned');
		saveItem(anna, 'movies', movie('1'), 'dropped');
		expect(findItem(anna, 'movies', '1')?.status).toBe('dropped');
		expect(findItem(ben, 'movies', '1')?.status).toBe('planned');
		// Saving again adds nothing
		expect(count(trackings)).toBe(2);
		expect(count(trackingMembers)).toBe(2);
	});

	it('lists, counts and search marks only show what is one’s own', () => {
		saveItem(anna, 'movies', movie('1', 'Anna’s'), 'planned');
		saveItem(ben, 'movies', movie('2', 'Ben’s'), 'active');
		expect(listLibrary(anna, 'movies').map((i) => i.title)).toEqual(['Anna’s']);
		expect(allItems(ben).map((i) => i.title)).toEqual(['Ben’s']);
		expect(countByCategory(anna)).toEqual({ movies: 1 });
		expect([...libraryStatusFor(anna, 'movies', ['1', '2'])]).toEqual([['1', 'planned']]);
		expect(findItem(anna, 'movies', '2')).toBeUndefined();
		// The title itself is known to the app, whoever tracks it
		expect(findTitle('movies', '2')?.title).toBe('Ben’s');
	});

	it('the bell is one’s own', () => {
		const mine = addItem({ externalId: '1', userId: anna });
		addItem({ externalId: '1', userId: ben });
		setNotify(anna, mine.id, false);
		expect(findItem(anna, 'movies', '1')?.notify).toBe(false);
		expect(findItem(ben, 'movies', '1')?.notify).toBe(true);
	});

	it('ticked episodes and the automatic status stay with the user', () => {
		const details = show('7');
		setEpisodes(anna, 'series', details, [{ season: 1, episode: 1 }], true);
		// The first ticked episode put the series into Anna's library, not into Ben's
		const hers = findItem(anna, 'series', '7')!;
		expect(hers.status).toBe('active');
		expect([...watchedKeys(hers.trackingId)]).toEqual(['1:1']);
		expect(findItem(ben, 'series', '7')).toBeUndefined();

		setEpisodes(ben, 'series', details, [{ season: 1, episode: 3 }], true);
		expect([...watchedKeys(findItem(ben, 'series', '7')!.trackingId)]).toEqual(['1:3']);
		expect([...watchedKeys(findItem(anna, 'series', '7')!.trackingId)]).toEqual(['1:1']);
	});

	it('the dashboard shows one’s own titles', () => {
		const today = new Date().toLocaleDateString('sv-SE');
		const mine = addItem({ externalId: '1', title: 'Mine', userId: anna });
		const theirs = addItem({ externalId: '2', title: 'Theirs', userId: ben });
		getDb()
			.insert(releases)
			.values([
				{ itemId: mine.id, kind: 'cinema', date: today },
				{ itemId: theirs.id, kind: 'cinema', date: today }
			])
			.run();
		expect(getDashboard(anna).recent.map((e) => e.title)).toEqual(['Mine']);
		expect(getDashboard(ben).recent.map((e) => e.title)).toEqual(['Theirs']);
	});
});

describe('removing', () => {
	it('takes a title out of one library and leaves it in the other', () => {
		const hers = addItem({ externalId: '1', userId: anna });
		const his = addItem({ externalId: '1', userId: ben });
		getDb()
			.insert(watchedEpisodes)
			.values({ trackingId: hers.trackingId, season: 1, episode: 1 })
			.run();
		getDb()
			.insert(watchedEpisodes)
			.values({ trackingId: his.trackingId, season: 1, episode: 2 })
			.run();

		removeItem(anna, 'movies', '1');
		expect(findItem(anna, 'movies', '1')).toBeUndefined();
		expect(findItem(ben, 'movies', '1')?.status).toBe('planned');
		// Her state and her episodes are gone, his are there, the title stays
		expect(count(trackings)).toBe(1);
		expect(
			getDb()
				.select()
				.from(watchedEpisodes)
				.all()
				.map((w) => w.episode)
		).toEqual([2]);
		expect(count(libraryItems)).toBe(1);
	});

	it('removes the title itself with everything stored about it once nobody tracks it', () => {
		const item = addItem({ externalId: '1', userId: anna });
		getDb().insert(releases).values({ itemId: item.id, kind: 'cinema', date: '2020-01-01' }).run();
		getDb()
			.insert(itemDetails)
			.values({ itemId: item.id, info: {} as never, show: null, fetchedAt: new Date() })
			.run();
		removeItem(anna, 'movies', '1');
		expect(count(libraryItems)).toBe(0);
		expect(getDb().select().from(releases).all()).toEqual([]);
		expect(getDb().select().from(itemDetails).all()).toEqual([]);
	});

	it('emptying a library touches nobody else’s', () => {
		addItem({ externalId: '1', userId: anna });
		addItem({ category: 'series', externalId: '2', userId: anna });
		addItem({ externalId: '1', userId: ben });
		addItem({ externalId: '3', userId: ben });

		expect(clearLibrary(anna, 'movies')).toBe(1);
		expect(allItems(anna).map((i) => i.category)).toEqual(['series']);
		expect(clearLibrary(anna, 'all')).toBe(1);
		expect(allItems(anna)).toEqual([]);
		expect(allItems(ben)).toHaveLength(2);
	});

	it('a state several users share stays for the others when one of them leaves', () => {
		const hers = addItem({ externalId: '1', status: 'active', userId: anna });
		// Ben joins Anna's state (how tracking together is stored)
		getDb()
			.insert(trackingMembers)
			.values({ trackingId: hers.trackingId, userId: ben, itemId: hers.id })
			.run();
		expect(findItem(ben, 'movies', '1')?.trackingId).toBe(hers.trackingId);

		// One state: a change by one is a change for both
		saveItem(ben, 'movies', movie('1'), 'completed');
		expect(findItem(anna, 'movies', '1')?.status).toBe('completed');

		removeItem(anna, 'movies', '1');
		expect(findItem(ben, 'movies', '1')?.status).toBe('completed');
		expect(count(trackings)).toBe(1);
	});

	it('deleting an account removes its library and nothing else', () => {
		addItem({ externalId: '1', userId: anna });
		addItem({ externalId: '1', userId: ben });
		addItem({ externalId: '2', userId: ben });
		getDb().delete(users).where(eq(users.id, ben)).run();
		expect(allItems(anna)).toHaveLength(1);
		expect(count(trackingMembers)).toBe(1);
	});
});

describe('the refresh follows whoever needs a title most', () => {
	it('an open state beats a completed one, which beats a dropped one', () => {
		const a = addItem({ externalId: '1', status: 'dropped', userId: anna });
		addItem({ externalId: '1', status: 'completed', userId: ben });
		const b = addItem({ externalId: '2', status: 'completed', userId: anna });
		addItem({ externalId: '2', status: 'planned', userId: ben });
		const c = addItem({ externalId: '3', status: 'dropped', userId: anna });
		const status = busiestStatus();
		expect(status.get(a.id)).toBe('completed');
		expect(status.get(b.id)).toBe('planned');
		expect(status.get(c.id)).toBe('dropped');
	});
});
