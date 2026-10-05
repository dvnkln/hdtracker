import { and, eq } from 'drizzle-orm';
import {
	checkPushover,
	cleanDevices,
	isPushoverKey,
	sendPushover,
	type PushoverConfig
} from './channels/pushover';
import {
	DEFAULT_BODY,
	MAX_BODY_LENGTH,
	MAX_HEADER_LENGTH,
	isWebhookUrl,
	parseHeader,
	sendWebhook,
	type WebhookConfig
} from './channels/webhook';
import {
	DEFAULT_SERVER,
	cleanServer,
	isNtfyToken,
	isNtfyTopic,
	sendNtfy,
	type NtfyConfig
} from './channels/ntfy';
import { getDb } from './db';
import { notificationChannels } from './db/schema';
import type { Image } from './images';

// Further ways to notify a user besides their own devices: a Pushover account, an ntfy
// topic, a webhook. A user can have several of each, every one with a name and a switch –
// switched off, it keeps its settings. Everything here works on the user's own channels only.

export type ChannelKind = 'pushover' | 'ntfy' | 'webhook';
export const CHANNEL_KINDS: ChannelKind[] = ['pushover', 'ntfy', 'webhook'];
export const MAX_CHANNELS = 10;
export const MAX_NAME_LENGTH = 40;

// A message on its way out of hdtracker: what a channel may need of it.
export type Outgoing = {
	title: string;
	body: string;
	// Address of the page the message is about, for opening it from outside (absolute), and
	// what to call that link
	link: string | null;
	linkTitle: string;
	// Address of the large picture (absolute, signed – loads without a login); null if none
	image: string | null;
	// The large picture as a file, built on request (null if there is none)
	picture: () => Promise<Image | null>;
	// How many titles the message is about
	count: number;
	test: boolean;
	// Address of the app's icon (absolute; null if the app does not know its own address)
	icon: string | null;
};

type Row = typeof notificationChannels.$inferSelect;

export function listChannels(userId: number) {
	return getDb()
		.select()
		.from(notificationChannels)
		.where(eq(notificationChannels.userId, userId))
		.orderBy(notificationChannels.id)
		.all();
}

const own = (userId: number, id: number) =>
	and(eq(notificationChannels.id, id), eq(notificationChannels.userId, userId));

export function getChannel(userId: number, id: number) {
	return getDb().select().from(notificationChannels).where(own(userId, id)).get();
}

// What the settings page may know about a channel: never the secrets themselves, only
// whether they are there.
export function publicChannel(row: Row) {
	const config = row.config as Partial<PushoverConfig & WebhookConfig & NtfyConfig>;
	return {
		id: row.id,
		kind: row.kind,
		name: row.name,
		enabled: row.enabled,
		lastOkAt: row.lastOkAt?.toISOString() ?? null,
		lastError: row.lastError,
		fields: {
			// Pushover
			devices: config.devices ?? '',
			known: config.known ?? [],
			picture: config.picture !== false,
			// Webhook (the address is shown: the user has to see where it goes)
			url: config.url ?? '',
			body: config.body ?? DEFAULT_BODY,
			hasHeader: !!config.header,
			// ntfy (server and topic are shown; the topic is what one subscribes to in the app)
			server: config.server ?? DEFAULT_SERVER,
			topic: config.topic ?? '',
			icon: config.icon ?? '',
			// Pushover's token is always there; this is about ntfy's optional one
			hasToken: row.kind === 'ntfy' && !!config.token
		}
	};
}

export type ChannelInput = {
	id: number | null; // null = a new one
	kind: string;
	name: string;
	// As typed. Secrets left empty keep what is stored.
	fields: Record<string, string>;
};
// `error` names what is wrong: a key of `notifications.channelErrors`, or Pushover's own words
export type SaveResult = { ok: true; id: number } | { ok: false; error: string; text?: string };

// Creates or changes a channel. Pushover: token and key are checked at Pushover first, so a
// typo shows now and not when the first message is due.
export async function saveChannel(userId: number, input: ChannelInput): Promise<SaveResult> {
	const existing = input.id === null ? undefined : getChannel(userId, input.id);
	if (input.id !== null && !existing) return { ok: false, error: 'unknown' };
	const kind = existing?.kind ?? input.kind;
	if (!CHANNEL_KINDS.includes(kind as ChannelKind)) return { ok: false, error: 'unknown' };
	if (!existing && listChannels(userId).length >= MAX_CHANNELS) {
		return { ok: false, error: 'tooMany' };
	}
	const name = input.name.trim();
	if (!name || name.length > MAX_NAME_LENGTH) return { ok: false, error: 'name' };

	const before = existing?.config;
	const made =
		kind === 'webhook'
			? webhookConfig(input.fields, before as Partial<WebhookConfig> | undefined)
			: kind === 'ntfy'
				? ntfyConfig(input.fields, before as Partial<NtfyConfig> | undefined)
				: await pushoverConfig(input.fields, before as Partial<PushoverConfig> | undefined);
	if (!('config' in made)) return made;
	const config = made.config;

	const db = getDb();
	if (existing) {
		db.update(notificationChannels)
			.set({ name, config, lastError: null })
			.where(own(userId, existing.id))
			.run();
		return { ok: true, id: existing.id };
	}
	const created = db
		.insert(notificationChannels)
		.values({ userId, kind: kind as ChannelKind, name, config })
		.returning({ id: notificationChannels.id })
		.get();
	return { ok: true, id: created.id };
}

type Fields = Record<string, string>;
type Made<T> = { config: T } | (SaveResult & { ok: false });

// Pushover: token and key are checked at Pushover (which also reports the device names).
async function pushoverConfig(
	fields: Fields,
	before: Partial<PushoverConfig> = {}
): Promise<Made<PushoverConfig>> {
	const token = fields.token?.trim() || before.token || '';
	const user = fields.user?.trim() || before.user || '';
	if (!isPushoverKey(token) || !isPushoverKey(user)) return { ok: false, error: 'keys' };
	const checked = await checkPushover(token, user);
	if (!checked.ok) {
		return checked.error === 'unreachable'
			? { ok: false, error: 'unreachable' }
			: { ok: false, error: 'refused', text: checked.error };
	}
	return {
		config: {
			token,
			user,
			devices: cleanDevices(fields.devices ?? ''),
			known: checked.devices,
			picture: fields.picture === 'on'
		}
	};
}

// Webhook: nothing is sent when saving – that is what "Test" is for.
function webhookConfig(fields: Fields, before: Partial<WebhookConfig> = {}): Made<WebhookConfig> {
	const url = (fields.url ?? '').trim();
	if (!isWebhookUrl(url)) return { ok: false, error: 'url' };
	const body = fields.body ?? '';
	if (!body.trim() || body.length > MAX_BODY_LENGTH) return { ok: false, error: 'body' };
	// The header may hold a secret: empty keeps the stored one, unless it is to be removed
	const typed = (fields.header ?? '').trim();
	const header = fields.clearHeader === '1' ? '' : typed || before.header || '';
	if (header && (header.length > MAX_HEADER_LENGTH || !parseHeader(header))) {
		return { ok: false, error: 'header' };
	}
	return { config: { url, body, header } };
}

// ntfy: nothing is sent when saving either. The token may be a secret: empty keeps it.
function ntfyConfig(fields: Fields, before: Partial<NtfyConfig> = {}): Made<NtfyConfig> {
	const server = cleanServer(fields.server ?? '');
	if (!server) return { ok: false, error: 'url' };
	const topic = (fields.topic ?? '').trim();
	if (!isNtfyTopic(topic)) return { ok: false, error: 'topic' };
	const token = fields.clearToken === '1' ? '' : fields.token?.trim() || before.token || '';
	if (token && !isNtfyToken(token)) return { ok: false, error: 'ntfyToken' };
	const icon = (fields.icon ?? '').trim();
	if (icon && !isWebhookUrl(icon)) return { ok: false, error: 'icon' };
	return { config: { server, topic, token, icon, picture: fields.picture === 'on' } };
}

export function setChannelEnabled(userId: number, id: number, enabled: boolean) {
	return (
		getDb().update(notificationChannels).set({ enabled }).where(own(userId, id)).run().changes > 0
	);
}

export function removeChannel(userId: number, id: number) {
	return getDb().delete(notificationChannels).where(own(userId, id)).run().changes > 0;
}

// Sends a message through one channel and remembers how it went (shown in the list).
export async function sendToChannel(row: Row, message: Outgoing) {
	const result =
		row.kind === 'webhook'
			? await sendWebhook(row.config as WebhookConfig, message)
			: row.kind === 'ntfy'
				? await sendNtfy(row.config as NtfyConfig, message)
				: await sendPushover(row.config as PushoverConfig, message);
	getDb()
		.update(notificationChannels)
		.set(result.ok ? { lastOkAt: new Date(), lastError: null } : { lastError: result.error })
		.where(eq(notificationChannels.id, row.id))
		.run();
	if (!result.ok)
		console.error(`Notification via "${row.name}" (${row.kind}) failed: ${result.error}`);
	return result;
}
