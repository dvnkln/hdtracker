// Tracking a title together. Whoever tracks a title can invite others; who accepts joins the
// inviting person's state (status and watched episodes) – from then on everybody in the group
// changes the same state. Somebody who leaves takes a copy of it along.
//
// All rules are here; the pages only call them. Who acts is always passed in.
import { and, count, eq, inArray, ne, type SQL } from 'drizzle-orm';
import type { Person } from '$lib/avatar';
import type { Status } from '$lib/status';
import { getDb } from './db';
import {
	invitations,
	libraryItems,
	trackingMembers,
	trackings,
	users,
	watchedEpisodes
} from './db/schema';
import { removeOrphans, type Title } from './library';
import { addNotice } from './noticeLog';
import { toPerson } from './users';

export type SharingError =
	// The acting user does not track this title
	| 'notYours'
	// No such account (or it is locked), no such invitation
	| 'unknown'
	// Inviting oneself
	| 'self'
	// Already tracks it together with the acting user
	| 'member'
	// Nobody else shares this state
	| 'alone';
type Failed = { ok: false; error: SharingError };

type Db = Pick<ReturnType<typeof getDb>, 'select' | 'insert' | 'update' | 'delete'>;

const membership = (userId: number, itemId: number, db: Db) =>
	db
		.select()
		.from(trackingMembers)
		.where(and(eq(trackingMembers.userId, userId), eq(trackingMembers.itemId, itemId)))
		.get();

// The other members of a tracking.
const othersIn = (trackingId: number, userId: number, db: Db) =>
	db
		.select({ userId: trackingMembers.userId })
		.from(trackingMembers)
		.where(and(eq(trackingMembers.trackingId, trackingId), ne(trackingMembers.userId, userId)))
		.all()
		.map((row) => row.userId);

// Invitations somebody sent for a tracking lapse when they leave it.
const dropSent = (userId: number, trackingId: number, db: Db) =>
	db
		.delete(invitations)
		.where(and(eq(invitations.fromUserId, userId), eq(invitations.trackingId, trackingId)))
		.run();

// Invites somebody to the state the acting user has for a title. Inviting the same person
// again changes nothing. Returns the invitation.
export function invite(
	by: number,
	itemId: number,
	to: number
): { ok: true; id: number; created: boolean } | Failed {
	if (to === by) return { ok: false, error: 'self' };
	return getDb().transaction((tx) => {
		const mine = membership(by, itemId, tx);
		if (!mine) return { ok: false, error: 'notYours' } as const;
		const target = tx
			.select({ id: users.id, disabled: users.disabled })
			.from(users)
			.where(eq(users.id, to))
			.get();
		if (!target || target.disabled) return { ok: false, error: 'unknown' } as const;
		if (membership(to, itemId, tx)?.trackingId === mine.trackingId) {
			return { ok: false, error: 'member' } as const;
		}
		const open = tx
			.select({ id: invitations.id })
			.from(invitations)
			.where(and(eq(invitations.trackingId, mine.trackingId), eq(invitations.toUserId, to)))
			.get();
		if (open) return { ok: true, id: open.id, created: false } as const;
		const made = tx
			.insert(invitations)
			.values({ trackingId: mine.trackingId, fromUserId: by, toUserId: to })
			.returning({ id: invitations.id })
			.get();
		return { ok: true, id: made.id, created: true } as const;
	});
}

// What the answer to an invitation was about – for telling the person who sent it.
type Answered = { ok: true; itemId: number; from: number };

// Accepts an invitation: the user joins the inviting person's state. A state of their own for
// this title is replaced by it (and gone, unless they shared it with others, who keep it); the
// day they added the title and their bell stay.
export function accept(userId: number, invitationId: number): Answered | Failed {
	return getDb().transaction((tx) => {
		const open = tx
			.select({
				id: invitations.id,
				trackingId: invitations.trackingId,
				from: invitations.fromUserId,
				itemId: trackings.itemId
			})
			.from(invitations)
			.innerJoin(trackings, eq(trackings.id, invitations.trackingId))
			.where(and(eq(invitations.id, invitationId), eq(invitations.toUserId, userId)))
			.get();
		if (!open) return { ok: false, error: 'unknown' } as const;

		const mine = membership(userId, open.itemId, tx);
		if (mine && mine.trackingId !== open.trackingId) {
			// Coming from another group: those who stay there learn that the user left
			addNotice(tx, 'left', open.itemId, userId, othersIn(mine.trackingId, userId, tx));
			dropSent(userId, mine.trackingId, tx);
			tx.delete(trackingMembers).where(eq(trackingMembers.id, mine.id)).run();
		}
		if (mine?.trackingId !== open.trackingId) {
			tx.insert(trackingMembers)
				.values({
					trackingId: open.trackingId,
					userId,
					itemId: open.itemId,
					addedAt: mine?.addedAt ?? new Date(),
					notify: mine?.notify ?? true
				})
				.run();
		}
		tx.delete(invitations).where(eq(invitations.id, open.id)).run();
		removeOrphans(tx);
		addNotice(tx, 'accepted', open.itemId, userId, [open.from]);
		return { ok: true, itemId: open.itemId, from: open.from } as const;
	});
}

// Declines an invitation. Nothing else changes.
export function decline(userId: number, invitationId: number): Answered | Failed {
	return getDb().transaction((tx) => {
		const open = tx
			.select({ id: invitations.id, from: invitations.fromUserId, itemId: trackings.itemId })
			.from(invitations)
			.innerJoin(trackings, eq(trackings.id, invitations.trackingId))
			.where(and(eq(invitations.id, invitationId), eq(invitations.toUserId, userId)))
			.get();
		if (!open) return { ok: false, error: 'unknown' } as const;
		tx.delete(invitations).where(eq(invitations.id, open.id)).run();
		addNotice(tx, 'declined', open.itemId, userId, [open.from]);
		return { ok: true, itemId: open.itemId, from: open.from } as const;
	});
}

// Takes back an invitation the user sent.
export function withdraw(userId: number, invitationId: number): { ok: true } | Failed {
	const removed = getDb()
		.delete(invitations)
		.where(and(eq(invitations.id, invitationId), eq(invitations.fromUserId, userId)))
		.run().changes;
	return removed ? { ok: true } : { ok: false, error: 'unknown' };
}

// Stops tracking a title together, but keeps tracking it: the user gets a state of their own
// that starts as a copy of the shared one (status and watched episodes). The others keep
// theirs. Returns who was left, for telling them.
export function leaveShared(
	userId: number,
	itemId: number
): { ok: true; others: number[] } | Failed {
	return getDb().transaction((tx) => {
		const mine = membership(userId, itemId, tx);
		if (!mine) return { ok: false, error: 'notYours' } as const;
		const others = othersIn(mine.trackingId, userId, tx);
		if (others.length === 0) return { ok: false, error: 'alone' } as const;

		const shared = tx.select().from(trackings).where(eq(trackings.id, mine.trackingId)).get()!;
		const own = tx
			.insert(trackings)
			.values({ itemId, status: shared.status, statusChangedAt: shared.statusChangedAt })
			.returning({ id: trackings.id })
			.get();
		const watched = tx
			.select()
			.from(watchedEpisodes)
			.where(eq(watchedEpisodes.trackingId, mine.trackingId))
			.all();
		if (watched.length > 0) {
			tx.insert(watchedEpisodes)
				.values(
					watched.map(({ season, episode, watchedAt }) => ({
						trackingId: own.id,
						season,
						episode,
						watchedAt
					}))
				)
				.run();
		}
		dropSent(userId, mine.trackingId, tx);
		tx.update(trackingMembers)
			.set({ trackingId: own.id })
			.where(eq(trackingMembers.id, mine.id))
			.run();
		addNotice(tx, 'left', itemId, userId, others);
		return { ok: true, others } as const;
	});
}

// ---- What the pages show ----

const personFields = {
	id: users.id,
	username: users.username,
	displayName: users.displayName,
	avatarColor: users.avatarColor,
	avatarUpdatedAt: users.avatarUpdatedAt
};

// Who else shares the user's state of a title (empty: they track it alone, or not at all).
export function companions(userId: number, itemId: number): Person[] {
	const db = getDb();
	const mine = membership(userId, itemId, db);
	if (!mine) return [];
	return db
		.select(personFields)
		.from(trackingMembers)
		.innerJoin(users, eq(users.id, trackingMembers.userId))
		.where(and(eq(trackingMembers.trackingId, mine.trackingId), ne(users.id, userId)))
		.orderBy(trackingMembers.addedAt, users.id)
		.all()
		.map(toPerson);
}

// The same for many titles at once (itemId -> the others), for posters and lists.
export function companionsByItem(userId: number): Map<number, Person[]> {
	const db = getDb();
	const mine = db
		.select({ trackingId: trackingMembers.trackingId })
		.from(trackingMembers)
		.where(eq(trackingMembers.userId, userId))
		.all()
		.map((row) => row.trackingId);
	const result = new Map<number, Person[]>();
	if (mine.length === 0) return result;
	const rows = db
		.select({ itemId: trackingMembers.itemId, person: personFields })
		.from(trackingMembers)
		.innerJoin(users, eq(users.id, trackingMembers.userId))
		.where(and(inArray(trackingMembers.trackingId, mine), ne(users.id, userId)))
		.orderBy(trackingMembers.addedAt, users.id)
		.all();
	for (const row of rows) {
		result.set(row.itemId, [...(result.get(row.itemId) ?? []), toPerson(row.person)]);
	}
	return result;
}

export type Invitation = {
	id: number;
	createdAt: Date;
	item: Title;
	// Who sent it and whom it went to
	from: Person;
	to: Person;
	// The state the invitation is about
	status: Status;
};

function openInvitations(where: SQL): Invitation[] {
	const db = getDb();
	const rows = db
		.select({
			id: invitations.id,
			createdAt: invitations.createdAt,
			from: invitations.fromUserId,
			to: invitations.toUserId,
			item: libraryItems,
			status: trackings.status
		})
		.from(invitations)
		.innerJoin(trackings, eq(trackings.id, invitations.trackingId))
		.innerJoin(libraryItems, eq(libraryItems.id, trackings.itemId))
		.where(where)
		.orderBy(invitations.createdAt, invitations.id)
		.all();
	if (rows.length === 0) return [];
	const people = new Map(
		db
			.select(personFields)
			.from(users)
			.where(inArray(users.id, [...new Set(rows.flatMap((row) => [row.from, row.to]))]))
			.all()
			.map((user) => [user.id, toPerson(user)])
	);
	return rows.map((row) => ({ ...row, from: people.get(row.from)!, to: people.get(row.to)! }));
}

// Invitations waiting for the user's answer, oldest first.
export const incoming = (userId: number) => openInvitations(eq(invitations.toUserId, userId));
// Invitations the user sent that are not answered yet.
export const outgoing = (userId: number) => openInvitations(eq(invitations.fromUserId, userId));

// How many invitations wait for the user's answer (the number in the header).
export function countIncoming(userId: number) {
	return (
		getDb().select({ n: count() }).from(invitations).where(eq(invitations.toUserId, userId)).get()
			?.n ?? 0
	);
}

// Whom the user could invite to a title: everybody who can log in and does not share the
// state already. `invitation` is set for those who are invited and have not answered yet.
export function invitable(
	userId: number,
	itemId: number
): { person: Person; invitation: number | null }[] {
	const db = getDb();
	const mine = membership(userId, itemId, db);
	if (!mine) return [];
	const inside = new Set(othersIn(mine.trackingId, userId, db));
	const open = new Map(
		db
			.select({ to: invitations.toUserId, id: invitations.id })
			.from(invitations)
			.where(eq(invitations.trackingId, mine.trackingId))
			.all()
			.map((row) => [row.to, row.id])
	);
	return db
		.select(personFields)
		.from(users)
		.where(and(ne(users.id, userId), eq(users.disabled, false)))
		.all()
		.filter((user) => !inside.has(user.id))
		.map((user) => ({ person: toPerson(user), invitation: open.get(user.id) ?? null }))
		.sort((a, b) => a.person.name.localeCompare(b.person.name, 'de', { sensitivity: 'base' }));
}

// Whether there is anybody to track together with: another account that can log in. While
// there is none, nothing about sharing is shown anywhere.
export function canShare(userId: number) {
	return !!getDb()
		.select({ id: users.id })
		.from(users)
		.where(and(ne(users.id, userId), eq(users.disabled, false)))
		.limit(1)
		.get();
}
