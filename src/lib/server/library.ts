import { and, count, eq, inArray, ne, notExists } from 'drizzle-orm';
import type { Category, Status } from '#lib/status.js';
import { getDb } from './db';
import { invitations, libraryItems, trackingMembers, trackings } from './db/schema';
import { addNotice } from './noticeLog';
import { announceSoon, type ShareEvent } from './shareNotify';
import { getUserSetting } from './settings';
import type { SearchResult } from './providers/types';

// A title as the data source describes it – stored once, whoever tracks it.
export type Title = typeof libraryItems.$inferSelect;
// A title in somebody's library: the title plus that user's state of it. Several users may
// share one state (`trackingId`); the bell (`notify`) is always their own.
export type LibraryItem = Title & {
	trackingId: number;
	status: Status;
	statusChangedAt: Date;
	addedAt: Date;
	notify: boolean;
};

// Which API each area uses.
export const SOURCE_FOR: Record<Category, SearchResult['source']> = {
	movies: 'tmdb',
	series: 'tmdb',
	anime: 'anilist',
	games: 'igdb'
};

type Db = Pick<ReturnType<typeof getDb>, 'select' | 'insert' | 'update' | 'delete'>;

// The titles of one user with their state. `where` narrows it down further.
function libraryOf(userId: number, where?: Parameters<typeof and>[0], db: Db = getDb()) {
	return db
		.select({
			item: libraryItems,
			trackingId: trackings.id,
			status: trackings.status,
			statusChangedAt: trackings.statusChangedAt,
			addedAt: trackingMembers.addedAt,
			notify: trackingMembers.notify
		})
		.from(trackingMembers)
		.innerJoin(trackings, eq(trackings.id, trackingMembers.trackingId))
		.innerJoin(libraryItems, eq(libraryItems.id, trackingMembers.itemId))
		.where(and(eq(trackingMembers.userId, userId), where))
		.all()
		.map(({ item, ...state }): LibraryItem => ({ ...item, ...state }));
}

const isTitle = (category: Category, externalId: string) =>
	and(
		eq(libraryItems.category, category),
		eq(libraryItems.source, SOURCE_FOR[category]),
		eq(libraryItems.externalId, externalId)
	);

// The whole library of a user, in the order the titles were stored.
export function allItems(userId: number) {
	return libraryOf(userId).sort((a, b) => a.id - b.id);
}

// All items of a category, sorted A–Z (German rules, so "Ä" sorts like "A").
// Anime are sorted by the title shown on top (English or Romaji, see settings).
export function listLibrary(userId: number, category: Category) {
	const items = libraryOf(userId, eq(libraryItems.category, category));
	const romaji = category === 'anime' && getUserSetting(userId, 'animeTitle') === 'romaji';
	const sortTitle = (i: LibraryItem) => (romaji && i.originalTitle) || i.title;
	return items.sort((a, b) =>
		sortTitle(a).localeCompare(sortTitle(b), 'de', { sensitivity: 'base' })
	);
}

// Status of the given search hits that are already in the user's library (externalId -> status).
export function libraryStatusFor(userId: number, category: Category, externalIds: string[]) {
	if (externalIds.length === 0) return new Map<string, Status>();
	const rows = libraryOf(
		userId,
		and(
			eq(libraryItems.category, category),
			eq(libraryItems.source, SOURCE_FOR[category]),
			inArray(libraryItems.externalId, externalIds)
		)
	);
	return new Map(rows.map((r) => [r.externalId, r.status]));
}

// A title as it is stored, whoever tracks it (e.g. to reuse what is already loaded about it).
export function findTitle(category: Category, externalId: string): Title | undefined {
	return getDb().select().from(libraryItems).where(isTitle(category, externalId)).get();
}

// The user's library entry for a title, if it is in their library.
export function findItem(
	userId: number,
	category: Category,
	externalId: string,
	db: Db = getDb()
): LibraryItem | undefined {
	return libraryOf(userId, isTitle(category, externalId), db)[0];
}

// Adds a title to the user's library, or only changes its status if it is there already (for
// everybody who shares that state). The title itself is stored once: if somebody else tracks
// it already, the user gets a state of their own for the same title.
export function saveItem(
	userId: number,
	category: Category,
	item: SearchResult,
	status: Status,
	db: Db = getDb()
) {
	const now = new Date();
	const run = (tx: Db) => {
		const mine = findItem(userId, category, item.externalId, tx);
		if (mine) {
			tx.update(trackings)
				.set({ status, statusChangedAt: now })
				.where(eq(trackings.id, mine.trackingId))
				.run();
			return;
		}
		tx.insert(libraryItems)
			.values({ ...item, category })
			.onConflictDoNothing()
			.run();
		const title = tx.select().from(libraryItems).where(isTitle(category, item.externalId)).get()!;
		const tracking = tx
			.insert(trackings)
			.values({ itemId: title.id, status, statusChangedAt: now })
			.returning({ id: trackings.id })
			.get();
		tx.insert(trackingMembers)
			.values({ trackingId: tracking.id, userId, itemId: title.id, addedAt: now })
			.run();
	};
	if (db === getDb()) getDb().transaction((tx) => run(tx));
	else run(db);
}

// Tidies up after members left: states nobody belongs to any more (with their watched
// episodes), then titles nobody tracks any more (with their details and release dates).
export function removeOrphans(db: Db = getDb()) {
	db.delete(trackings)
		.where(
			notExists(
				db
					.select({ id: trackingMembers.id })
					.from(trackingMembers)
					.where(eq(trackingMembers.trackingId, trackings.id))
			)
		)
		.run();
	db.delete(libraryItems)
		.where(
			notExists(
				db.select({ id: trackings.id }).from(trackings).where(eq(trackings.itemId, libraryItems.id))
			)
		)
		.run();
}

// Takes titles out of the user's library. Others who track the same title keep it – also
// those who shared the state with this user. Invitations the user sent for these titles
// lapse. Returns how many titles were taken out.
function leave(userId: number, itemIds: number[]) {
	if (itemIds.length === 0) return 0;
	const events: ShareEvent[] = [];
	const count = getDb().transaction((tx) => {
		const left = tx
			.select({ trackingId: trackingMembers.trackingId })
			.from(trackingMembers)
			.where(and(eq(trackingMembers.userId, userId), inArray(trackingMembers.itemId, itemIds)))
			.all()
			.map((row) => row.trackingId);
		if (left.length > 0) {
			// Those who tracked a title together with the user learn that they left
			const others = tx
				.select({ userId: trackingMembers.userId, itemId: trackingMembers.itemId })
				.from(trackingMembers)
				.where(and(inArray(trackingMembers.trackingId, left), ne(trackingMembers.userId, userId)))
				.all();
			for (const other of others) {
				addNotice(tx, 'left', other.itemId, userId, [other.userId]);
				events.push({ kind: 'left', actorId: userId, to: other.userId, itemId: other.itemId });
			}
			tx.delete(invitations)
				.where(and(eq(invitations.fromUserId, userId), inArray(invitations.trackingId, left)))
				.run();
		}
		const removed = tx
			.delete(trackingMembers)
			.where(and(eq(trackingMembers.userId, userId), inArray(trackingMembers.itemId, itemIds)))
			.run().changes;
		removeOrphans(tx);
		return removed;
	});
	announceSoon(events);
	return count;
}

export function removeItem(userId: number, category: Category, externalId: string) {
	const item = findItem(userId, category, externalId);
	if (item) leave(userId, [item.id]);
}

// Empties the user's library for one category (or all of them), including their watched
// episodes. Returns how many items were removed.
export function clearLibrary(userId: number, category: Category | 'all') {
	const items = libraryOf(
		userId,
		category === 'all' ? undefined : eq(libraryItems.category, category)
	);
	return leave(
		userId,
		items.map((item) => item.id)
	);
}

// The bell on a title's page: notifications about it for this user on or off.
export function setNotify(userId: number, itemId: number, notify: boolean) {
	getDb()
		.update(trackingMembers)
		.set({ notify })
		.where(and(eq(trackingMembers.userId, userId), eq(trackingMembers.itemId, itemId)))
		.run();
}

// ---- Validation of item data sent by the browser ----

function optionalString(value: unknown, max: number) {
	if (value === null || value === undefined || value === '') return null;
	if (typeof value !== 'string') throw new Error('invalid string');
	return value.slice(0, max);
}

// Parses the hidden JSON field of the item form. Throws on anything unexpected.
export function parseItem(category: Category, json: string): SearchResult {
	const raw = JSON.parse(json) as Record<string, unknown>;

	if (raw.source !== SOURCE_FOR[category]) throw new Error('wrong source');
	if (typeof raw.externalId !== 'string' || !/^\d{1,12}$/.test(raw.externalId)) {
		throw new Error('invalid externalId');
	}
	const title = optionalString(raw.title, 500);
	if (!title) throw new Error('missing title');

	const year = raw.year === null ? null : Number(raw.year);
	if (year !== null && !(Number.isInteger(year) && year > 1800 && year < 2200)) {
		throw new Error('invalid year');
	}

	const releaseDate = optionalString(raw.releaseDate, 10);
	if (releaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate))
		throw new Error('invalid releaseDate');

	const malId = raw.malId === null || raw.malId === undefined ? null : Number(raw.malId);
	if (malId !== null && !(Number.isInteger(malId) && malId > 0)) throw new Error('invalid malId');

	const posterUrl = optionalString(raw.posterUrl, 1000);
	if (posterUrl && !posterUrl.startsWith('https://')) throw new Error('invalid posterUrl');

	return {
		source: SOURCE_FOR[category],
		externalId: raw.externalId,
		title,
		originalTitle: optionalString(raw.originalTitle, 500),
		year,
		releaseDate,
		earlyAccess: raw.earlyAccess === true,
		malId,
		posterUrl,
		overview: optionalString(raw.overview, 5000)
	};
}

// Number of entries per area in the user's library, e.g. { anime: 9 }.
export function countByCategory(userId: number) {
	const rows = getDb()
		.select({ category: libraryItems.category, n: count() })
		.from(trackingMembers)
		.innerJoin(libraryItems, eq(libraryItems.id, trackingMembers.itemId))
		.where(eq(trackingMembers.userId, userId))
		.groupBy(libraryItems.category)
		.all();
	return Object.fromEntries(rows.map((r) => [r.category, r.n])) as Partial<
		Record<Category, number>
	>;
}

// Number of titles stored, whoever tracks them.
export function countTitles() {
	return getDb().select({ n: count() }).from(libraryItems).get()?.n ?? 0;
}

// Everybody who has a title in their library, with their state of it (for what a refresh of
// the title finds out, see announcements.ts).
export function trackersOf(itemId: number) {
	return getDb()
		.select({
			userId: trackingMembers.userId,
			trackingId: trackingMembers.trackingId,
			status: trackings.status,
			notify: trackingMembers.notify
		})
		.from(trackingMembers)
		.innerJoin(trackings, eq(trackings.id, trackingMembers.trackingId))
		.where(eq(trackingMembers.itemId, itemId))
		.all();
}

// Adds a title to the libraries of several people as one state they share (as if they had
// accepted invitations) – for a new season of something they track together (announcements.ts).
// Each keeps their own bell (`notify`: taken over from the season before). Only for people who
// do not have the title yet.
export function saveTogether(
	members: { userId: number; notify: boolean }[],
	category: Category,
	item: SearchResult,
	status: Status
) {
	if (members.length === 0) return;
	const now = new Date();
	getDb().transaction((tx) => {
		tx.insert(libraryItems)
			.values({ ...item, category })
			.onConflictDoNothing()
			.run();
		const title = tx.select().from(libraryItems).where(isTitle(category, item.externalId)).get()!;
		const tracking = tx
			.insert(trackings)
			.values({ itemId: title.id, status, statusChangedAt: now })
			.returning({ id: trackings.id })
			.get();
		tx.insert(trackingMembers)
			.values(
				members.map(({ userId, notify }) => ({
					trackingId: tracking.id,
					userId,
					itemId: title.id,
					addedAt: now,
					notify
				}))
			)
			.run();
	});
}
