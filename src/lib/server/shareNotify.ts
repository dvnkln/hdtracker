// Push messages about tracking together: an invitation came, one was answered, somebody left.
// Sent at once (not at the hour chosen for releases), to the targets of whoever it concerns,
// in their language – if they left the switch for that kind on (Settings → Notifications).
//
// The inbox gets the same events as notices (noticeLog.ts) whether or not anything is sent.
// This file knows the tables only – library.ts and sharing.ts use it, it uses neither.
import { eq, inArray } from 'drizzle-orm';
import { imageSource } from '$lib/images';
import { LAYOUTS } from './collage';
import { getDb } from './db';
import { libraryItems, users } from './db/schema';
import { localeOf, serverMessages, withLocale } from './i18n';
import { signedAvatarPath, signedCollagePath } from './images';
import { getUserSetting, type UserSettingKey } from './settings';
import { deliver, hasEnabledTarget, type Notice } from './targets';

export type ShareKind = 'invited' | 'accepted' | 'declined' | 'left';
// `actorId` did something with the title `itemId` that concerns `to`.
export type ShareEvent = { kind: ShareKind; actorId: number; to: number; itemId: number };

// The switch of each kind (an answer is an answer, accepted or declined).
const SWITCH: Record<ShareKind, UserSettingKey> = {
	invited: 'notifyInvited',
	accepted: 'notifyAnswered',
	declined: 'notifyAnswered',
	left: 'notifyLeft'
};
export const wantsShareNotice = (userId: number, kind: ShareKind) =>
	getUserSetting(userId, SWITCH[kind]) === 'on';

// The small picture of such a message: the photo of whoever did it, if they uploaded one –
// otherwise two people in the colours of the logo (the server cannot draw the letter on a
// colour that stands in for a photo inside the app).
const ICON = '/icons/share.png';
// `picture` is the version of the photo, as in a Person (avatar.ts); null without one.
type Actor = { id: number; name: string; picture?: number | null };
const iconOf = (actor: Actor) =>
	actor.picture != null ? signedAvatarPath(actor.id, actor.picture) : ICON;
// So many titles are named in a message about several; the rest is counted.
const NAMED = 3;

type Item = typeof libraryItems.$inferSelect;

// The message for one person about what one other person did – with one title, or several
// at once (inviting to a selection, emptying a library): then one message, not one each.
// Written in the language the work runs in.
export function shareMessage(kind: ShareKind, actor: Actor, items: Item[], romaji = false): Notice {
	const m = serverMessages().notifications.share;
	const shown = (item: Item) =>
		(romaji && item.category === 'anime' && item.originalTitle) || item.title;
	const posters = items
		.map((item) => item.posterUrl)
		.filter((address): address is string => !!address && imageSource(address) !== null);

	if (items.length === 1) {
		const [item] = items;
		return {
			title: shown(item),
			body: m[kind](actor.name),
			// An invitation is answered in the inbox; the rest is about the title
			url: kind === 'invited' ? '/inbox' : `/${item.category}/${item.externalId}`,
			tag: `share-${kind}-${actor.id}-${item.id}`,
			icon: iconOf(actor),
			count: 1,
			...(posters.length
				? {
						image: signedCollagePath(posters, 'banner'),
						source: { layout: 'banner' as const, addresses: posters }
					}
				: { source: null })
		};
	}
	const names = items.slice(0, NAMED).map(shown);
	if (items.length > NAMED) names.push(serverMessages().notifications.more(items.length - NAMED));
	const wide = posters.slice(0, LAYOUTS.wide.max);
	return {
		title: m.several[kind](actor.name, items.length),
		body: names.join('\n'),
		url: '/inbox',
		tag: `share-${kind}-${actor.id}-many`,
		icon: iconOf(actor),
		count: items.length,
		...(wide.length >= 2
			? {
					image: signedCollagePath(wide, 'wide'),
					source: { layout: 'wide' as const, addresses: wide }
				}
			: { source: null })
	};
}

// Tells everybody concerned. Events of the same kind by the same person for the same receiver
// become one message. Never throws: a message that cannot be sent must not undo what happened.
export async function announce(events: ShareEvent[]) {
	const groups = new Map<string, ShareEvent[]>();
	for (const event of events) {
		const key = `${event.to}:${event.kind}:${event.actorId}`;
		groups.set(key, [...(groups.get(key) ?? []), event]);
	}
	for (const group of groups.values()) {
		const { to, kind, actorId } = group[0];
		try {
			if (!wantsShareNotice(to, kind) || !hasEnabledTarget(to)) continue;
			const db = getDb();
			const actor = db
				.select({
					username: users.username,
					displayName: users.displayName,
					avatarUpdatedAt: users.avatarUpdatedAt
				})
				.from(users)
				.where(eq(users.id, actorId))
				.get();
			const items = db
				.select()
				.from(libraryItems)
				.where(inArray(libraryItems.id, [...new Set(group.map((event) => event.itemId))]))
				.all()
				.sort((a, b) => a.title.localeCompare(b.title, 'de', { sensitivity: 'base' }));
			if (!actor || items.length === 0) continue;
			// (The name others see – the same rule as shownName() in users.ts.)
			const name = actor.displayName?.trim() || actor.username;
			const picture = actor.avatarUpdatedAt?.getTime() ?? null;
			const romaji = getUserSetting(to, 'animeTitle') === 'romaji';
			await withLocale(localeOf(to), () =>
				deliver(to, shareMessage(kind, { id: actorId, name, picture }, items, romaji))
			);
		} catch (err) {
			console.error(`Message about tracking together for user ${to} failed`, err);
		}
	}
}

// For the rules: send in the background, after what happened is stored.
export function announceSoon(events: ShareEvent[]) {
	if (events.length > 0) void announce(events);
}
