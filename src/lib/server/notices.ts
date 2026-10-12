// The inbox: what waits for the user in the app – releases of titles they track, and what
// others did with titles tracked together. (Open invitations are listed next to it, see
// sharing.ts.) Independent of push notifications: these notices are written for everybody.
//
// Unread until the user has seen it; read notices are removed after a week.
import { and, eq, isNull, lt, type SQL } from 'drizzle-orm';
import type { Person } from '$lib/avatar';
import type { Category } from '$lib/status';
import { trackedEvents } from './dashboard';
import { getDb } from './db';
import { libraryItems, notices, users, type NoticeKind, type ReleaseKind } from './db/schema';
import { today } from './providers/types';
import { countIncoming } from './sharing';
import { toPerson } from './users';

// A release that was missed (server off) still gets a notice for this long.
const CATCH_UP_DAYS = 2;
// Read notices are kept this long.
const KEEP_READ_DAYS = 7;

const daysBefore = (day: string, days: number) => {
	const date = new Date(`${day}T12:00:00`);
	date.setDate(date.getDate() - days);
	return date.toLocaleDateString('sv-SE');
};

// Notes what was released for the user: the dates the dashboard shows under "recently
// released" (the same rule, see trackedEvents) of the last days up to today. Not for titles
// muted with the bell, and nothing dated before the user added the title. Running it again
// changes nothing. Returns how many notices were added.
export function collectReleases(userId: number, day = today()) {
	const since = daysBefore(day, CATCH_UP_DAYS);
	const values = trackedEvents(userId).flatMap(({ item, events }) => {
		if (!item.notify) return [];
		const added = item.addedAt.toLocaleDateString('sv-SE');
		return events
			.filter((r) => r.date !== null && r.date >= since && r.date <= day && r.date >= added)
			.map((r) => ({
				userId,
				kind: 'release' as const,
				itemId: item.id,
				releaseKind: r.kind,
				season: r.season ?? 0,
				episode: r.episode ?? 0,
				date: r.date
			}));
	});
	let added = 0;
	for (let i = 0; i < values.length; i += 200) {
		added += getDb()
			.insert(notices)
			.values(values.slice(i, i + 200))
			.onConflictDoNothing()
			.run().changes;
	}
	return added;
}

// One line of the inbox.
export type NoticeLine = {
	key: string;
	kind: NoticeKind;
	unread: boolean;
	at: Date;
	item: {
		category: Category;
		externalId: string;
		title: string;
		originalTitle: string | null;
		posterUrl: string | null;
	};
	// Who did it (not for releases)
	actor: Person | null;
	// What was released; several new episodes of a title are one line (first to last)
	release: {
		kind: ReleaseKind;
		season: number | null;
		episode: number | null;
		lastSeason: number | null;
		lastEpisode: number | null;
		date: string | null;
	} | null;
};

// The user's notices, newest first.
export function listNotices(userId: number): NoticeLine[] {
	const rows = getDb()
		.select({
			notice: notices,
			item: {
				category: libraryItems.category,
				externalId: libraryItems.externalId,
				title: libraryItems.title,
				originalTitle: libraryItems.originalTitle,
				posterUrl: libraryItems.posterUrl
			},
			actor: {
				id: users.id,
				username: users.username,
				displayName: users.displayName,
				avatarColor: users.avatarColor,
				avatarUpdatedAt: users.avatarUpdatedAt
			}
		})
		.from(notices)
		.innerJoin(libraryItems, eq(libraryItems.id, notices.itemId))
		.leftJoin(users, eq(users.id, notices.actorId))
		.where(eq(notices.userId, userId))
		.all();

	const lines: NoticeLine[] = [];
	// New episodes of a title: one line for the unread ones, one for those already read
	const episodes = new Map<string, typeof rows>();
	for (const row of rows) {
		const { notice } = row;
		if (notice.kind === 'release' && notice.releaseKind === 'episode') {
			const key = `episodes:${notice.itemId}:${notice.readAt ? 'read' : 'new'}`;
			episodes.set(key, [...(episodes.get(key) ?? []), row]);
			continue;
		}
		lines.push({
			key: `notice:${notice.id}`,
			kind: notice.kind,
			unread: !notice.readAt,
			at: notice.createdAt,
			item: row.item,
			actor: row.actor ? toPerson(row.actor) : null,
			release:
				notice.kind === 'release' && notice.releaseKind
					? {
							kind: notice.releaseKind,
							season: null,
							episode: null,
							lastSeason: null,
							lastEpisode: null,
							date: notice.date
						}
					: null
		});
	}
	for (const [key, group] of episodes) {
		const sorted = group
			.map((row) => row.notice)
			.sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0));
		const first = sorted[0];
		const last = sorted.at(-1)!;
		lines.push({
			key,
			kind: 'release',
			unread: !first.readAt,
			at: new Date(Math.max(...sorted.map((n) => n.createdAt.getTime()))),
			item: group[0].item,
			actor: null,
			release: {
				kind: 'episode',
				season: first.season,
				episode: first.episode,
				lastSeason: last.season,
				lastEpisode: last.episode,
				date:
					sorted
						.map((n) => n.date ?? '')
						.sort()
						.at(-1) || null
			}
		});
	}
	// Newest first; what was released on the same run by its date, then A–Z
	return lines.sort(
		(a, b) =>
			b.at.getTime() - a.at.getTime() ||
			(b.release?.date ?? '').localeCompare(a.release?.date ?? '') ||
			a.item.title.localeCompare(b.item.title, 'de', { sensitivity: 'base' })
	);
}

// The number at the bell: unread lines plus invitations waiting for an answer.
export function countOpen(userId: number) {
	return listNotices(userId).filter((line) => line.unread).length + countIncoming(userId);
}

// The user has seen their notices – all of them (the inbox), or only the releases (the
// dashboard shows those as well).
export function markRead(userId: number, only?: 'release') {
	const where: SQL[] = [eq(notices.userId, userId), isNull(notices.readAt)];
	if (only) where.push(eq(notices.kind, only));
	getDb()
		.update(notices)
		.set({ readAt: new Date() })
		.where(and(...where))
		.run();
}

// Removes what was read long enough ago. Unread notices stay until they are read.
export function pruneRead(now = new Date()) {
	const before = new Date(now.getTime() - KEEP_READ_DAYS * 24 * 60 * 60 * 1000);
	return getDb().delete(notices).where(lt(notices.readAt, before)).run().changes;
}
