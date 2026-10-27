// Writing a notice for somebody's inbox – kept apart from notices.ts so the rules that cause
// notices (library.ts, sharing.ts) can use it without knowing anything else about the inbox.
import type { getDb } from './db';
import { notices, type NoticeKind } from './db/schema';

type Db = Pick<ReturnType<typeof getDb>, 'insert'>;

// Tells `to` that a new season of a title became known: `season` for a series (its number),
// none for an anime (the new season is a title of its own); `date` its start, if known.
export function addAnnouncement(
	db: Db,
	itemId: number,
	to: number[],
	season: number | null,
	date: string | null
) {
	if (to.length === 0) return;
	db.insert(notices)
		.values(to.map((userId) => ({ userId, kind: 'announced' as const, itemId, season, date })))
		.run();
}

// Tells `to` what `actorId` did with a title they track together.
export function addNotice(
	db: Db,
	kind: Exclude<NoticeKind, 'release' | 'announced'>,
	itemId: number,
	actorId: number,
	to: number[]
) {
	if (to.length === 0) return;
	db.insert(notices)
		.values(to.map((userId) => ({ userId, kind, itemId, actorId })))
		.run();
}
