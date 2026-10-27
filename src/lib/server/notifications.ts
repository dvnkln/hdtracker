import { and, eq, lt } from 'drizzle-orm';
import { eventLabel } from '#lib/eventLabel.js';
import { byEpisode, getDashboard, toEntry, trackedEvents, type DashboardEntry } from './dashboard';
import { getDb } from './db';
import {
	itemDetails,
	libraryItems,
	notices,
	notificationsSent,
	releases,
	trackingMembers,
	trackings,
	users
} from './db/schema';
import { localeOf, serverMessages, withLocale } from './i18n';
import { collectReleases, pruneRead } from './notices';
import { imageSource } from '#lib/images.js';
import { LAYOUTS, preparePictures, type Layout } from './collage';
import { signedCollagePath, signedImagePath } from './images';
import { today } from './providers/types';
import { deliver, hasEnabledTarget, type Notice, type PictureSource } from './targets';
import { enabledCategories, getUserSetting, setUserSettings } from './settings';

// Tells the user about what came out today: new episodes and seasons, cinema and home
// releases, game releases – exactly what shows up under "recently released" on the dashboard
// (see trackedEvents). Only the day of a release is known, not the time, so the messages of
// a day are sent from an hour the user chooses.

export type NotifyMode = 'off' | 'single' | 'digest';
export const NOTIFY_MODES: NotifyMode[] = ['off', 'single', 'digest'];

// Saves what the user chose. Switching the messages on starts today: nothing that came out
// before is announced.
export function savePrefs(userId: number, mode: NotifyMode, hour: number) {
	const before = prefsFor(userId);
	const switchedOn = before.mode === 'off' && mode !== 'off';
	setUserSettings(userId, {
		notifyMode: mode,
		notifyHour: String(hour),
		...(switchedOn ? { notifyFrom: today() } : {})
	});
	if (switchedOn) void preparePictures();
}

// Called at startup: loads the tool that builds the pictures of notifications if anybody
// has notifications switched on – then, and not in the middle of the day (see collage.ts).
export function prepareNotificationPictures() {
	const everyone = getDb().select({ id: users.id }).from(users).all();
	if (everyone.some(({ id }) => prefsFor(id).mode !== 'off')) void preparePictures();
}

// What a user wants – the one place that reads it.
export function prefsFor(userId: number) {
	const mode = getUserSetting(userId, 'notifyMode') as NotifyMode;
	const hour = Number(getUserSetting(userId, 'notifyHour'));
	return {
		mode: NOTIFY_MODES.includes(mode) ? mode : 'off',
		hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 9,
		from: getUserSetting(userId, 'notifyFrom')
	};
}

// A release that was missed (server off, device unreachable) is still announced for this long.
const CATCH_UP_DAYS = 2;

type Row = typeof releases.$inferSelect;
// What is due: releases (`rows`), or a new season that became known (`announced`, the day it was
// found – see announcements.ts)
type Due = {
	entry: DashboardEntry;
	itemId: number;
	rows: Row[];
	announced?: { season: number | null; date: string | null; found: string };
};

const daysBefore = (day: string, days: number) => {
	const date = new Date(`${day}T12:00:00`);
	date.setDate(date.getDate() - days);
	return date.toLocaleDateString('sv-SE');
};
const sentKey = (r: {
	itemId: number;
	kind: string;
	season: number | null;
	episode: number | null;
	date: string | null;
}) => `${r.itemId}:${r.kind}:${r.season ?? 0}:${r.episode ?? 0}:${r.date}`;

// What is to be announced to the user now: releases of the last days up to today that were
// not announced yet. One entry per date of a movie or game; the new episodes of a show
// together as one entry.
export function dueEvents(userId: number, day = today()): Due[] {
	const { from } = prefsFor(userId);
	const since = [daysBefore(day, CATCH_UP_DAYS), from].sort().at(-1)!;
	const sent = new Set(
		getDb()
			.select()
			.from(notificationsSent)
			.where(eq(notificationsSent.userId, userId))
			.all()
			.map(sentKey)
	);
	const due: Due[] = [];
	for (const { item, events } of trackedEvents(userId)) {
		if (!item.notify) continue; // muted with the bell on its page
		const fresh = events.filter(
			(r) => r.date !== null && r.date >= since && r.date <= day && !sent.has(sentKey(r))
		);
		for (const r of fresh.filter((e) => e.kind !== 'episode')) {
			due.push({ entry: toEntry(item, r), itemId: item.id, rows: [r] });
		}
		const episodes = fresh.filter((e) => e.kind === 'episode').sort(byEpisode);
		if (episodes.length) {
			const entry = toEntry(item, episodes[0], episodes.at(-1));
			due.push({ entry, itemId: item.id, rows: episodes });
		}
	}
	due.push(...dueAnnouncements(userId, since, day, sent));
	// Like the lists of the app: A–Z
	return due.sort((a, b) =>
		a.entry.title.localeCompare(b.entry.title, 'de', { sensitivity: 'base' })
	);
}

// New seasons that became known (notices written by announcements.ts) – from the day they were
// found, like a release from its day; not for titles muted since or of hidden areas.
function dueAnnouncements(userId: number, since: string, day: string, sent: Set<string>): Due[] {
	const shown = enabledCategories(userId);
	return getDb()
		.select({ notice: notices, item: libraryItems, status: trackings.status })
		.from(notices)
		.innerJoin(libraryItems, eq(libraryItems.id, notices.itemId))
		.innerJoin(
			trackingMembers,
			and(eq(trackingMembers.itemId, notices.itemId), eq(trackingMembers.userId, userId))
		)
		.innerJoin(trackings, eq(trackings.id, trackingMembers.trackingId))
		.where(
			and(
				eq(notices.userId, userId),
				eq(notices.kind, 'announced'),
				eq(trackingMembers.notify, true)
			)
		)
		.all()
		.flatMap(({ notice, item, status }) => {
			const found = notice.createdAt.toLocaleDateString('sv-SE');
			const key = sentKey({
				itemId: item.id,
				kind: 'announced',
				season: notice.season,
				episode: 0,
				date: found
			});
			if (found < since || found > day || sent.has(key) || !shown.includes(item.category)) {
				return [];
			}
			const entry: DashboardEntry = {
				itemId: item.id,
				category: item.category,
				externalId: item.externalId,
				title: item.title,
				originalTitle: item.originalTitle,
				posterUrl: item.posterUrl,
				status,
				kind: 'release',
				date: notice.date,
				season: notice.season,
				episode: null,
				lastSeason: null,
				lastEpisode: null
			};
			return [
				{
					entry,
					itemId: item.id,
					rows: [],
					announced: { season: notice.season, date: notice.date, found }
				}
			];
		});
}

// What a message says about one thing that is due: what was released – or that a new season
// became known, with its start if known ("Season 8 announced · from Apr 12, 2027").
function labelOf(d: Due, m: ReturnType<typeof serverMessages>) {
	if (!d.announced) return eventLabel(d.entry, m);
	const what = m.inbox.announced(d.announced.season);
	if (!d.announced.date) return what;
	const date = new Intl.DateTimeFormat(m.locale, { dateStyle: 'medium' }).format(
		new Date(`${d.announced.date}T12:00:00`)
	);
	return `${what} · ${m.inbox.startsOn(date)}`;
}

// The title as the user sees it everywhere (anime: English or Romaji on top, see settings).
const shownTitle = (entry: DashboardEntry, romaji: boolean) =>
	(romaji && entry.category === 'anime' && entry.originalTitle) || entry.title;
const prefersRomaji = (userId: number) => getUserSetting(userId, 'animeTitle') === 'romaji';

// The small picture of every notification: a calendar in the colours of the logo.
const ICON = '/icons/notify.png';

// So many titles are listed in a digest; the rest is counted.
const DIGEST_LINES = 6;

// The large picture of a title for the opened-up notification: a film card made of its
// poster (see collage.ts). A title without a poster gets its backdrop instead, if one is
// stored with its details; with neither, no picture. `image` is the signed address the
// devices load it from, `source` says what it is made of (for channels that take a file).
function bigPicture(entry: DashboardEntry): { image?: string; source: PictureSource | null } {
	const usable = (address: string | null | undefined) =>
		address && imageSource(address) ? address : null;
	const poster = usable(entry.posterUrl);
	if (poster) return collage([poster], 'banner');
	const stored = getDb()
		.select({ info: itemDetails.info })
		.from(itemDetails)
		.innerJoin(libraryItems, eq(libraryItems.id, itemDetails.itemId))
		.where(
			and(eq(libraryItems.category, entry.category), eq(libraryItems.externalId, entry.externalId))
		)
		.get();
	const backdrop = usable(stored?.info.backdropUrl);
	if (!backdrop) return { source: null };
	return { image: signedImagePath(backdrop) ?? undefined, source: { address: backdrop } };
}
const collage = (addresses: string[], layout: Layout) => ({
	image: signedCollagePath(addresses, layout),
	source: { layout, addresses }
});

// The messages for what is due: one per title, or one for all of them. The small picture is
// always the calendar; the large one, shown when the notification is opened up, is the film
// card of the title – for a summary of several titles their posters side by side.
// Written in the language the work runs in (see i18n.ts); `romaji`: the receiver wants anime
// under their Japanese title.
export function buildMessages(
	due: Due[],
	mode: NotifyMode,
	day = today(),
	romaji = false
): Notice[] {
	const m = serverMessages();
	if (due.length === 0 || mode === 'off') return [];

	if (mode === 'digest') {
		const titles = [...new Set(due.map((d) => d.itemId))].length;
		const lines = due
			.slice(0, DIGEST_LINES)
			.map((d) => `${shownTitle(d.entry, romaji)} – ${labelOf(d, m)}`);
		if (due.length > DIGEST_LINES) lines.push(m.notifications.more(due.length - DIGEST_LINES));
		const posters = [...new Set(due.map((d) => d.entry.posterUrl))].filter(
			(address): address is string => !!address && imageSource(address) !== null
		);
		return [
			{
				title: m.notifications.digestTitle(titles),
				body: lines.join('\n'),
				url: '/',
				tag: `digest-${day}`,
				icon: ICON,
				count: titles,
				...(posters.length >= 2
					? collage(posters.slice(0, LAYOUTS.wide.max), 'wide')
					: bigPicture(due[0].entry))
			}
		];
	}

	// One message per title; several dates of a title on the same day in one text
	const perItem = new Map<number, Due[]>();
	for (const d of due) perItem.set(d.itemId, [...(perItem.get(d.itemId) ?? []), d]);
	return [...perItem.values()].map((own) => ({
		title: shownTitle(own[0].entry, romaji),
		body: own.map((d) => labelOf(d, m)).join(' · '),
		url: `/${own[0].entry.category}/${own[0].entry.externalId}`,
		tag: `item-${own[0].itemId}`,
		icon: ICON,
		count: 1,
		...bigPicture(own[0].entry)
	}));
}

// For the test of a target: a message that looks like a real one – in the form the user
// chose, made from the newest releases of the dashboard, marked as a test. With an empty
// dashboard a plain sentence.
export function sampleMessage(userId: number): Notice {
	const m = serverMessages().notifications;
	const { mode } = prefsFor(userId);
	const recent = getDashboard(userId).recent.filter((entry) => entry.date !== null);
	const newest = recent.sort((a, b) => b.date!.localeCompare(a.date!)).slice(0, 3);
	const due = newest.map((entry, index) => ({ entry, itemId: index, rows: [] }));
	const [message] = messagesFor(
		userId,
		mode === 'digest' ? due : due.slice(0, 1),
		mode === 'digest' ? 'digest' : 'single'
	);
	if (!message) {
		return {
			title: m.testTitle,
			body: m.testBody,
			url: '/settings/notifications',
			tag: 'test',
			source: null,
			count: 0,
			test: true
		};
	}
	return { ...message, title: `${m.testMark} · ${message.title}`, tag: 'test', test: true };
}

function markSent(userId: number, due: Due[]) {
	const values = due.flatMap((d) => [
		...(d.announced
			? [
					{
						userId,
						itemId: d.itemId,
						kind: 'announced' as const,
						season: d.announced.season ?? 0,
						episode: 0,
						date: d.announced.found
					}
				]
			: []),
		...d.rows.map((r) => ({
			userId,
			itemId: r.itemId,
			kind: r.kind,
			season: r.season ?? 0,
			episode: r.episode ?? 0,
			date: r.date!
		}))
	]);
	for (let i = 0; i < values.length; i += 200) {
		getDb()
			.insert(notificationsSent)
			.values(values.slice(i, i + 200))
			.onConflictDoNothing()
			.run();
	}
}

// Sends what is due to one user, in their language. Returns how many messages went out.
export function notifyUser(userId: number, now = new Date()) {
	return withLocale(localeOf(userId), () => notify(userId, now));
}

// The messages as this user wants to read them (anime title as they chose it).
export const messagesFor = (userId: number, due: Due[], mode: NotifyMode, day = today()) =>
	buildMessages(due, mode, day, prefersRomaji(userId));

async function notify(userId: number, now: Date) {
	const { mode, hour } = prefsFor(userId);
	if (mode === 'off' || now.getHours() < hour) return 0;
	const day = now.toLocaleDateString('sv-SE');
	const due = dueEvents(userId, day);
	if (due.length === 0) return 0;

	// Nobody to tell: do not save it up for the day a target is switched on.
	if (!hasEnabledTarget(userId)) {
		markSent(userId, due);
		return 0;
	}

	let sentMessages = 0;
	for (const message of messagesFor(userId, due, mode, day)) {
		const results = await deliver(userId, message);
		// Reached no target at all: try again with the next run (for as long as it is fresh).
		if (!results.some((r) => r.ok)) continue;
		sentMessages++;
		const covered = mode === 'digest' ? due : due.filter((d) => `item-${d.itemId}` === message.tag);
		markSent(userId, covered);
	}
	return sentMessages;
}

// Background task "notifications" (hourly): every user who switched the messages on.
export async function sendDueNotifications(now = new Date()) {
	const everyone = getDb().select({ id: users.id }).from(users).all();
	for (const { id } of everyone) {
		try {
			// The inbox gets its notices whether or not anything is sent
			collectReleases(id, now.toLocaleDateString('sv-SE'));
			await notifyUser(id, now);
		} catch (err) {
			console.error(`Notifications for user ${id} failed`, err);
		}
	}
	pruneSent(now);
	pruneRead(now);
}

// What was announced long ago can be forgotten (it is far outside the days looked at).
function pruneSent(now: Date) {
	const before = daysBefore(now.toLocaleDateString('sv-SE'), 30);
	getDb().delete(notificationsSent).where(lt(notificationsSent.date, before)).run();
}
