import { beforeEach, describe, expect, it } from 'vitest';
import { count, eq } from 'drizzle-orm';
import { addItem } from '../../tests/helpers';
import { getDb } from './db';
import { invitations, libraryItems, trackings, users, watchedEpisodes } from './db/schema';
import { watchedKeys } from './episodes';
import { allItems, clearLibrary, findItem, removeItem, saveItem } from './library';
import {
	accept,
	canShare,
	companions,
	companionsByItem,
	countIncoming,
	decline,
	incoming,
	invitable,
	invite,
	leaveShared,
	outgoing,
	withdraw
} from './sharing';
import { deleteUser, setDisabled } from './users';

let ann: number, ben: number, cleo: number;
const account = (username: string, role: 'admin' | 'user' = 'user') =>
	getDb().insert(users).values({ username, passwordHash: 'x', role }).returning().get().id;
const watch = (trackingId: number, ...episodes: number[]) =>
	getDb()
		.insert(watchedEpisodes)
		.values(episodes.map((episode) => ({ trackingId, season: 1, episode })))
		.run();
const rows = (
	table: typeof invitations | typeof trackings | typeof watchedEpisodes | typeof libraryItems
) => getDb().select({ n: count() }).from(table).get()!.n;
const openCount = () => rows(invitations);
const show = { category: 'series', externalId: '7', title: 'Show' } as const;
const mine = (userId: number) => findItem(userId, 'series', '7');
// Invites and returns the invitation's number
function invited(by: number, itemId: number, to: number) {
	const result = invite(by, itemId, to);
	if (!result.ok) throw new Error(result.error);
	return result.id;
}

beforeEach(() => {
	const db = getDb();
	db.delete(libraryItems).run();
	db.delete(users).run();
	ann = account('ann', 'admin');
	ben = account('ben');
	cleo = account('cleo');
});

describe('inviting', () => {
	it('needs the title in the own library, another account that can log in, and happens once', () => {
		const item = addItem({ ...show, userId: ann });
		expect(invite(ben, item.id, ann)).toEqual({ ok: false, error: 'notYours' });
		expect(invite(ann, item.id, ann)).toEqual({ ok: false, error: 'self' });
		expect(invite(ann, item.id, 9999)).toEqual({ ok: false, error: 'unknown' });
		setDisabled(cleo, true, ann);
		expect(invite(ann, item.id, cleo)).toEqual({ ok: false, error: 'unknown' });

		const first = invite(ann, item.id, ben);
		expect(first).toMatchObject({ ok: true, created: true });
		expect(invite(ann, item.id, ben)).toMatchObject({ ok: true, created: false });
		expect(openCount()).toBe(1);
	});

	it('shows up for both: waiting for an answer here, not answered yet there', () => {
		const item = addItem({ ...show, userId: ann, status: 'active' });
		const id = invited(ann, item.id, ben);
		expect(countIncoming(ben)).toBe(1);
		expect(countIncoming(ann)).toBe(0);
		expect(incoming(ben)).toMatchObject([
			{ id, status: 'active', item: { title: 'Show' }, from: { name: 'ann' }, to: { name: 'ben' } }
		]);
		expect(outgoing(ann)).toHaveLength(1);
		expect(incoming(cleo)).toEqual([]);
		// Who can still be asked, and who was asked already
		expect(invitable(ann, item.id)).toMatchObject([
			{ person: { name: 'ben' }, invitation: id },
			{ person: { name: 'cleo' }, invitation: null }
		]);
		expect(invitable(ben, item.id)).toEqual([]); // not his title
	});
});

describe('accepting', () => {
	it('joins the inviting state: status and watched episodes are the same for both from then on', () => {
		const item = addItem({ ...show, userId: ann, status: 'active' });
		watch(item.trackingId, 1, 2);
		expect(accept(ben, invited(ann, item.id, ben))).toEqual({
			ok: true,
			itemId: item.id,
			from: ann
		});

		expect(mine(ben)).toMatchObject({ trackingId: item.trackingId, status: 'active' });
		expect(watchedKeys(mine(ben)!.trackingId).size).toBe(2);
		expect(openCount()).toBe(0);
		expect(companions(ann, item.id).map((p) => p.name)).toEqual(['ben']);
		expect(companions(ben, item.id).map((p) => p.name)).toEqual(['ann']);
		expect(invitable(ann, item.id).map((entry) => entry.person.name)).toEqual(['cleo']);

		// Either of them changes it for both
		saveItem(ben, 'series', { ...item, externalId: '7' }, 'completed');
		expect(mine(ann)?.status).toBe('completed');
		expect(invite(ann, item.id, ben)).toEqual({ ok: false, error: 'member' });
	});

	it('replaces a state of one’s own, but keeps the day the title was added and the bell', () => {
		const anns = addItem({ ...show, userId: ann, status: 'active' });
		watch(anns.trackingId, 1, 2, 3);
		const bens = addItem({ ...show, userId: ben, status: 'dropped', notify: false });
		watch(bens.trackingId, 9);

		accept(ben, invited(ann, anns.id, ben));
		const now = mine(ben)!;
		expect(now).toMatchObject({ trackingId: anns.trackingId, status: 'active', notify: false });
		expect(now.addedAt).toEqual(bens.addedAt);
		expect([...watchedKeys(now.trackingId)].sort()).toEqual(['1:1', '1:2', '1:3']);
		// Ben's old state is gone, with its episodes
		expect(rows(trackings)).toBe(1);
		expect(rows(watchedEpisodes)).toBe(3);
	});

	it('only works for the person invited, and only while the invitation is open', () => {
		const item = addItem({ ...show, userId: ann });
		const id = invited(ann, item.id, ben);
		expect(accept(cleo, id)).toEqual({ ok: false, error: 'unknown' });
		expect(decline(cleo, id)).toEqual({ ok: false, error: 'unknown' });
		expect(withdraw(ben, id)).toEqual({ ok: false, error: 'unknown' });
		expect(accept(ben, id).ok).toBe(true);
		expect(accept(ben, id)).toEqual({ ok: false, error: 'unknown' });
	});

	it('moving to another group leaves the old one to the others', () => {
		// Ann and Ben track it together; Cleo, on her own, invites Ben over
		const anns = addItem({ ...show, userId: ann, status: 'active' });
		accept(ben, invited(ann, anns.id, ben));
		const cleos = addItem({ ...show, userId: cleo, status: 'paused' });
		const pending = invited(ben, anns.id, cleo); // Ben had asked Cleo into the old group

		accept(ben, invited(cleo, cleos.id, ben));
		expect(mine(ben)).toMatchObject({ trackingId: cleos.trackingId, status: 'paused' });
		expect(mine(ann)).toMatchObject({ trackingId: anns.trackingId, status: 'active' });
		expect(companions(ann, anns.id)).toEqual([]);
		// What Ben sent for the group he left no longer stands
		expect(withdraw(ben, pending)).toEqual({ ok: false, error: 'unknown' });
		expect(openCount()).toBe(0);
	});
});

describe('declining and withdrawing', () => {
	it('change nothing but the invitation', () => {
		const item = addItem({ ...show, userId: ann });
		expect(decline(ben, invited(ann, item.id, ben))).toEqual({
			ok: true,
			itemId: item.id,
			from: ann
		});
		expect(mine(ben)).toBeUndefined();
		expect(withdraw(ann, invited(ann, item.id, cleo))).toEqual({ ok: true });
		expect(openCount()).toBe(0);
		expect(invited(ann, item.id, ben)).toBeGreaterThan(0); // asking again is possible
	});
});

describe('leaving', () => {
	it('with a copy: the state so far stays, from then on each has their own', () => {
		const item = addItem({ ...show, userId: ann, status: 'active' });
		watch(item.trackingId, 1, 2);
		accept(ben, invited(ann, item.id, ben));
		const asked = invited(ben, item.id, cleo);

		expect(leaveShared(ben, item.id)).toEqual({ ok: true, others: [ann] });
		const bens = mine(ben)!;
		expect(bens.trackingId).not.toBe(item.trackingId);
		expect(bens).toMatchObject({ status: 'active', statusChangedAt: item.statusChangedAt });
		expect(watchedKeys(bens.trackingId).size).toBe(2);
		expect(companions(ann, item.id)).toEqual([]);
		expect(withdraw(ben, asked)).toEqual({ ok: false, error: 'unknown' }); // lapsed

		watch(bens.trackingId, 3);
		saveItem(ben, 'series', { ...item, externalId: '7' }, 'completed');
		expect(mine(ann)?.status).toBe('active');
		expect(watchedKeys(item.trackingId).size).toBe(2);
	});

	it('is only for somebody who tracks the title together with others', () => {
		const item = addItem({ ...show, userId: ann });
		expect(leaveShared(ann, item.id)).toEqual({ ok: false, error: 'alone' });
		expect(leaveShared(ben, item.id)).toEqual({ ok: false, error: 'notYours' });
	});

	it('by removing the title: gone for oneself, the others keep everything', () => {
		const item = addItem({ ...show, userId: ann, status: 'active' });
		watch(item.trackingId, 1);
		accept(ben, invited(ann, item.id, ben));
		const asked = invited(ann, item.id, cleo);

		removeItem(ann, 'series', '7');
		expect(mine(ann)).toBeUndefined();
		expect(mine(ben)).toMatchObject({ trackingId: item.trackingId, status: 'active' });
		expect(watchedKeys(item.trackingId).size).toBe(1);
		// Ann's open invitation went with her
		expect(accept(cleo, asked)).toEqual({ ok: false, error: 'unknown' });

		// The last one out takes the state and the title along, and what was still open
		invited(ben, item.id, cleo);
		clearLibrary(ben, 'all');
		expect(rows(libraryItems)).toBe(0);
		expect(openCount()).toBe(0);
	});

	it('by deleting the account: shared titles go on for the others, invitations are gone', () => {
		const shared = addItem({ ...show, userId: ben, status: 'active' });
		accept(cleo, invited(ben, shared.id, cleo));
		const alone = addItem({ category: 'movies', externalId: '3', title: 'Film', userId: ben });
		invited(ben, alone.id, cleo);
		const cleos = addItem({ category: 'movies', externalId: '4', title: 'Other', userId: cleo });
		invited(cleo, cleos.id, ben);

		expect(deleteUser(ben, ann)).toEqual({ ok: true });
		expect(allItems(cleo).map((item) => item.title)).toEqual(['Show', 'Other']);
		expect(companions(cleo, shared.id)).toEqual([]);
		expect(openCount()).toBe(0);
		expect(getDb().select().from(libraryItems).where(eq(libraryItems.id, alone.id)).get()).toBe(
			undefined
		);
	});
});

describe('who tracks along', () => {
	it('needs a second account that can log in', () => {
		expect(canShare(ann)).toBe(true);
		setDisabled(ben, true, ann);
		setDisabled(cleo, true, ann);
		expect(canShare(ann)).toBe(false);
	});

	it('is known for the whole library at once – only for shared titles, never oneself', () => {
		const show1 = addItem({ ...show, userId: ann });
		const film = addItem({ category: 'movies', externalId: '3', title: 'Film', userId: ann });
		addItem({ category: 'movies', externalId: '3', title: 'Film', userId: cleo }); // on her own
		accept(ben, invited(ann, show1.id, ben));
		accept(cleo, invited(ben, show1.id, cleo)); // every member may invite

		const byItem = companionsByItem(ann);
		expect(byItem.get(show1.id)?.map((p) => p.name)).toEqual(['ben', 'cleo']);
		expect(byItem.has(film.id)).toBe(false);
		expect(
			companionsByItem(cleo)
				.get(show1.id)
				?.map((p) => p.name)
		).toEqual(['ann', 'ben']);
	});
});
