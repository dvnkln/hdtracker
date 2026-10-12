// Writing a notice for somebody's inbox – kept apart from notices.ts so the rules that cause
// notices (library.ts, sharing.ts) can use it without knowing anything else about the inbox.
import type { getDb } from './db';
import { notices, type NoticeKind } from './db/schema';

type Db = Pick<ReturnType<typeof getDb>, 'insert'>;

// Tells `to` what `actorId` did with a title they track together.
export function addNotice(
	db: Db,
	kind: Exclude<NoticeKind, 'release'>,
	itemId: number,
	actorId: number,
	to: number[]
) {
	if (to.length === 0) return;
	db.insert(notices)
		.values(to.map((userId) => ({ userId, kind, itemId, actorId })))
		.run();
}
