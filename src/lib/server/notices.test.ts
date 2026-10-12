import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { addItem } from '../../tests/helpers';
import { getDb } from './db';
import { libraryItems, notices, releases, trackingMembers, users } from './db/schema';
import { removeItem, setNotify } from './library';
import { collectReleases, countOpen, listNotices, markRead, pruneRead } from './notices';
import { sendDueNotifications } from './notifications';
import { accept, decline, invite, leaveShared, withdraw } from './sharing';

const TODAY = '2026-10-05';
const day = (offset: number) => {
	const date = new Date(`${TODAY}T12:00:00`);
	date.setDate(date.getDate() + offset);
	return date.toLocaleDateString('sv-SE');
};

let ann: number, ben: number;
let n = 0;
type Kind = (typeof releases.$inferInsert)['kind'];
// A title somebody added a while ago, with its dates: [kind, date, season, episode]
function title(values: Parameters<typeof addItem>[0], dates: [Kind, string, number?, number?][]) {
	const item = addItem({ externalId: String(++n), userId: ann, ...values });
	getDb()
		.update(trackingMembers)
		.set({ addedAt: new Date(`${day(-30)}T12:00:00`) })
		.where(eq(trackingMembers.itemId, item.id))
		.run();
	if (dates.length) {
		getDb()
			.insert(releases)
			.values(
				dates.map(([kind, date, season, episode]) => ({
					itemId: item.id,
					kind,
					date,
					season: season ?? null,
					episode: episode ?? null
				}))
			)
			.run();
	}
	return item;
}
const invited = (by: number, itemId: number, to: number) => {
	const result = invite(by, itemId, to);
	if (!result.ok) throw new Error(result.error);
	return result.id;
};
// What the inbox says, short: "Title: kind" (and who)
const said = (userId: number) =>
	listNotices(userId).map(
		(line) =>
			`${line.item.title}: ${line.release?.kind ?? line.kind}${line.actor ? ` by ${line.actor.name}` : ''}`
	);

beforeEach(() => {
	const db = getDb();
	db.delete(libraryItems).run();
	db.delete(users).run();
	const account = (username: string) =>
		db.insert(users).values({ username, passwordHash: 'x', role: 'admin' }).returning().get().id;
	ann = account('ann');
	ben = account('ben');
});

describe('releases', () => {
	it('are noted once: what came out in the last days up to today', () => {
		title({ title: 'Out today', category: 'movies' }, [['cinema', TODAY]]);
		title({ title: 'Out yesterday', category: 'games' }, [['release', day(-1)]]);
		title({ title: 'Tomorrow', category: 'movies' }, [['cinema', day(1)]]);
		title({ title: 'Long ago', category: 'movies' }, [['cinema', day(-5)]]);
		title({ title: 'Dropped', category: 'movies', status: 'dropped' }, [['cinema', TODAY]]);

		expect(collectReleases(ann, TODAY)).toBe(2);
		expect(collectReleases(ann, TODAY)).toBe(0); // again: nothing new
		expect(said(ann).sort()).toEqual(['Out today: cinema', 'Out yesterday: release']);
		expect(countOpen(ann)).toBe(2);
		expect(countOpen(ben)).toBe(0); // not his titles
	});

	it('are not noted for a muted title, nor for dates before the title was added', () => {
		const muted = title({ title: 'Muted', category: 'movies' }, [['cinema', TODAY]]);
		setNotify(ann, muted.id, false);
		const fresh = title({ title: 'Just added', category: 'movies' }, [['cinema', day(-1)]]);
		getDb()
			.update(trackingMembers)
			.set({ addedAt: new Date(`${TODAY}T08:00:00`) })
			.where(eq(trackingMembers.itemId, fresh.id))
			.run();
		expect(collectReleases(ann, TODAY)).toBe(0);
	});

	it('put the new episodes of a show on one line', () => {
		title({ title: 'Show', category: 'series', status: 'active' }, [
			['episode', day(-1), 2, 3],
			['episode', TODAY, 2, 4],
			['episode', day(7), 2, 5]
		]);
		collectReleases(ann, TODAY);
		const [line, ...rest] = listNotices(ann);
		expect(rest).toEqual([]);
		expect(line).toMatchObject({
			unread: true,
			release: {
				kind: 'episode',
				season: 2,
				episode: 3,
				lastSeason: 2,
				lastEpisode: 4,
				date: TODAY
			}
		});
		expect(countOpen(ann)).toBe(1);
	});

	it('are written by the hourly task for everybody, whether or not anything is sent', async () => {
		title({ title: 'Film', category: 'movies' }, [['cinema', TODAY]]);
		await sendDueNotifications(new Date(`${TODAY}T03:30:00`)); // notifications are off
		expect(said(ann)).toEqual(['Film: cinema']);
	});
});

describe('reading', () => {
	it('the dashboard reads the releases, the inbox everything; read notices go after a week', () => {
		const film = title({ title: 'Film', category: 'movies' }, [['cinema', TODAY]]);
		collectReleases(ann, TODAY);
		decline(ben, invited(ann, film.id, ben));
		expect(countOpen(ann)).toBe(2);

		markRead(ann, 'release');
		expect(countOpen(ann)).toBe(1);
		expect(listNotices(ann).map((line) => [line.kind, line.unread])).toEqual(
			expect.arrayContaining([
				['release', false],
				['declined', true]
			])
		);
		markRead(ann);
		expect(countOpen(ann)).toBe(0);
		expect(listNotices(ann)).toHaveLength(2); // still to be read up on

		const later = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
		expect(pruneRead(later(6))).toBe(0);
		expect(pruneRead(later(8))).toBe(2);
		// Gone, and not noted a second time by a later run on the same day
		expect(listNotices(ann)).toEqual([]);
	});

	it('what was not read stays, however old', () => {
		title({ title: 'Film', category: 'movies' }, [['cinema', TODAY]]);
		collectReleases(ann, TODAY);
		expect(pruneRead(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))).toBe(0);
		expect(countOpen(ann)).toBe(1);
	});
});

describe('tracking together', () => {
	it('an invitation counts until it is answered; the answer is a notice for who asked', () => {
		const film = title({ title: 'Film', category: 'movies' }, []);
		const show = title({ title: 'Show', category: 'series' }, []);
		const first = invited(ann, film.id, ben);
		const second = invited(ann, show.id, ben);
		expect(countOpen(ben)).toBe(2);
		expect(countOpen(ann)).toBe(0);

		accept(ben, first);
		decline(ben, second);
		expect(countOpen(ben)).toBe(0);
		expect(said(ann).sort()).toEqual(['Film: accepted by ben', 'Show: declined by ben']);
		expect(countOpen(ann)).toBe(2);

		// Taking an invitation back tells nobody
		withdraw(ann, invited(ann, show.id, ben));
		expect(said(ben)).toEqual([]);
	});

	it('leaving – with a copy or by removing the title – tells those who stay', () => {
		const film = title({ title: 'Film', category: 'movies' }, []);
		const show = title({ title: 'Show', category: 'series' }, []);
		accept(ben, invited(ann, film.id, ben));
		accept(ben, invited(ann, show.id, ben));
		markRead(ann);

		leaveShared(ben, film.id);
		removeItem(ben, 'series', show.externalId);
		expect(
			listNotices(ann)
				.filter((line) => line.unread)
				.map((line) => `${line.item.title}: ${line.kind} by ${line.actor?.name}`)
				.sort()
		).toEqual(['Film: left by ben', 'Show: left by ben']);
		// Removing a title one tracks alone tells nobody
		removeItem(ann, 'movies', film.externalId);
		expect(said(ben)).toEqual([]);
	});

	it('notices go with the title and with either account', () => {
		const film = title({ title: 'Film', category: 'movies' }, [['cinema', TODAY]]);
		collectReleases(ann, TODAY);
		decline(ben, invited(ann, film.id, ben));
		getDb().delete(users).where(eq(users.id, ben)).run();
		expect(said(ann)).toEqual(['Film: cinema']);
		removeItem(ann, 'movies', film.externalId);
		expect(getDb().select().from(notices).all()).toEqual([]);
	});
});
