import { and, eq } from 'drizzle-orm';
import webpush from 'web-push';
import { getDb } from './db';
import { pushSubscriptions } from './db/schema';
import { getSetting, setSettings } from './settings';

// Push notifications without any extra app (Web Push): the browser gives the page an address
// at its maker's push service; the server sends an encrypted message there and the push
// service wakes the device. Only the device can read the message – the push service sees
// that something was sent, not what.

// The push services of the browsers. The address comes from the browser, so it is checked
// against this list: the server must never be made to send requests to arbitrary addresses.
const PUSH_HOSTS = [
	'fcm.googleapis.com', // Chrome, Edge on Android, most Chromium browsers
	'updates.push.services.mozilla.com', // Firefox
	'web.push.apple.com', // Safari, installed apps on iPhone/iPad
	'.notify.windows.com' // Edge on Windows
];

export function isPushService(endpoint: string) {
	let url: URL;
	try {
		url = new URL(endpoint);
	} catch {
		return false;
	}
	if (url.protocol !== 'https:' || url.port || url.username || url.password) return false;
	return PUSH_HOSTS.some((host) =>
		host.startsWith('.') ? url.hostname.endsWith(host) : url.hostname === host
	);
}

// Who sends the messages: push services want a contact they could turn to.
const CONTACT = 'https://github.com/dvnkln/hdtracker';
const TIMEOUT_MS = 10_000;
// A message nobody could be given for a day is dropped by the push service.
const KEEP_SECONDS = 24 * 60 * 60;
const MAX_DEVICES = 20;

// The key pair of this installation, created the first time it is needed.
function vapidKeys() {
	let publicKey = getSetting('vapidPublicKey');
	let privateKey = getSetting('vapidPrivateKey');
	if (!publicKey || !privateKey) {
		({ publicKey, privateKey } = webpush.generateVAPIDKeys());
		setSettings({ vapidPublicKey: publicKey, vapidPrivateKey: privateKey });
	}
	return { publicKey, privateKey };
}

// The public key a browser needs to subscribe.
export function pushPublicKey() {
	return vapidKeys().publicKey;
}

// ---- Devices ----

// A readable name for a device from what the browser says about itself.
// The first match wins (Edge and Opera also call themselves Chrome, Chrome also Safari).
const SYSTEMS: [RegExp, string][] = [
	[/iPhone/, 'iPhone'],
	[/iPad/, 'iPad'],
	[/Android/, 'Android'],
	[/Windows/, 'Windows'],
	[/Macintosh|Mac OS X/, 'Mac'],
	[/Linux|X11/, 'Linux']
];
const BROWSERS: [RegExp, string][] = [
	[/Edg(e|A|iOS)?\//, 'Edge'],
	[/Firefox\/|FxiOS\//, 'Firefox'],
	[/OPR\//, 'Opera'],
	[/Chrome\/|CriOS\//, 'Chrome'],
	[/Safari\//, 'Safari']
];
export function deviceLabel(userAgent: string) {
	const named = (list: [RegExp, string][]) =>
		list.find(([pattern]) => pattern.test(userAgent))?.[1];
	return [named(BROWSERS), named(SYSTEMS)].filter(Boolean).join(' · ') || 'Browser';
}

const BASE64URL = /^[A-Za-z0-9_-]+$/;
const bytes = (text: string) => Buffer.from(text, 'base64url').length;

export type NewSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

// What a browser sends after subscribing, checked: a known push service and keys of the
// right size (a 65-byte public key, a 16-byte secret).
export function parseSubscription(json: string): NewSubscription | null {
	let value: unknown;
	try {
		value = JSON.parse(json);
	} catch {
		return null;
	}
	const sub = value as Partial<NewSubscription> | null;
	const endpoint = sub?.endpoint;
	const p256dh = sub?.keys?.p256dh;
	const auth = sub?.keys?.auth;
	if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof auth !== 'string') {
		return null;
	}
	if (endpoint.length > 2000 || !isPushService(endpoint)) return null;
	if (!BASE64URL.test(p256dh) || bytes(p256dh) !== 65) return null;
	if (!BASE64URL.test(auth) || bytes(auth) !== 16) return null;
	return { endpoint, keys: { p256dh, auth } };
}

export function listDevices(userId: number) {
	return getDb()
		.select({
			id: pushSubscriptions.id,
			endpoint: pushSubscriptions.endpoint,
			label: pushSubscriptions.label,
			createdAt: pushSubscriptions.createdAt,
			lastOkAt: pushSubscriptions.lastOkAt,
			enabled: pushSubscriptions.enabled
		})
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.userId, userId))
		.orderBy(pushSubscriptions.id)
		.all();
}

// Stores a device for the user. A device that is already known (same address) simply moves
// to this user with its fresh keys. Returns false if the user has too many devices.
export function addDevice(userId: number, sub: NewSubscription, userAgent: string) {
	const db = getDb();
	const known = db
		.select({ id: pushSubscriptions.id })
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.endpoint, sub.endpoint))
		.get();
	if (!known && listDevices(userId).length >= MAX_DEVICES) return false;
	// (A known device keeps its name – the user may have changed it.)
	const values = { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth };
	db.insert(pushSubscriptions)
		.values({ endpoint: sub.endpoint, label: deviceLabel(userAgent), ...values })
		.onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values })
		.run();
	return true;
}

export const MAX_LABEL_LENGTH = 40;

// Gives one of the user's own devices another name. Returns whether that worked.
export function renameDevice(userId: number, id: number, label: string) {
	const name = label.trim();
	if (!name || name.length > MAX_LABEL_LENGTH) return false;
	return (
		getDb()
			.update(pushSubscriptions)
			.set({ label: name })
			.where(and(eq(pushSubscriptions.id, id), eq(pushSubscriptions.userId, userId)))
			.run().changes > 0
	);
}

// Switches one of the user's own devices off or on again. Returns whether there was one.
export function setDeviceEnabled(userId: number, id: number, enabled: boolean) {
	return (
		getDb()
			.update(pushSubscriptions)
			.set({ enabled })
			.where(and(eq(pushSubscriptions.id, id), eq(pushSubscriptions.userId, userId)))
			.run().changes > 0
	);
}

// Removes one of the user's own devices. Returns whether there was one.
export function removeDevice(userId: number, id: number) {
	return (
		getDb()
			.delete(pushSubscriptions)
			.where(and(eq(pushSubscriptions.id, id), eq(pushSubscriptions.userId, userId)))
			.run().changes > 0
	);
}

// ---- Sending ----

// What the service worker shows: title and text, and the page to open when tapped. Messages
// with the same tag replace each other on the device.
export type PushMessage = {
	title: string;
	body: string;
	url: string;
	tag?: string;
	// Small picture next to the text (address on this server); the app icon if left out
	icon?: string;
	// Large picture shown when the notification is opened up (Android, Chrome on computers)
	image?: string;
};
export type PushResult = { id: number; label: string; ok: boolean; gone: boolean };

// Sends a message to the devices of a user that are switched on, one after the other – or,
// with `only`, to that one device whether it is switched on or not (test). A device the push
// service no longer knows (the app was removed, the permission withdrawn) is deleted.
export async function sendPush(
	userId: number,
	message: PushMessage,
	only?: number
): Promise<PushResult[]> {
	const db = getDb();
	const devices = db
		.select()
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.userId, userId))
		.orderBy(pushSubscriptions.id)
		.all()
		.filter((device) => (only === undefined ? device.enabled : device.id === only));
	const vapidDetails = { subject: CONTACT, ...vapidKeys() };
	const results: PushResult[] = [];

	for (const device of devices) {
		let ok = false;
		let gone = false;
		try {
			// Checked again when sending: the list of services may have changed since it was stored.
			if (!isPushService(device.endpoint)) throw new Error('not a known push service');
			const request = webpush.generateRequestDetails(
				{ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
				JSON.stringify(message),
				{ vapidDetails, TTL: KEEP_SECONDS }
			);
			const res = await fetch(request.endpoint, {
				method: 'POST',
				headers: request.headers as Record<string, string>,
				body: request.body ? new Uint8Array(request.body) : undefined,
				signal: AbortSignal.timeout(TIMEOUT_MS)
			});
			if (res.status === 404 || res.status === 410) {
				gone = true;
				db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, device.id)).run();
				console.log(`Push: "${device.label}" is no longer registered, removed`);
			} else if (res.ok) {
				ok = true;
				db.update(pushSubscriptions)
					.set({ lastOkAt: new Date() })
					.where(eq(pushSubscriptions.id, device.id))
					.run();
			} else {
				console.error(`Push to "${device.label}" failed: HTTP ${res.status}`, await res.text());
			}
		} catch (err) {
			console.error(`Push to "${device.label}" failed`, err);
		}
		results.push({ id: device.id, label: device.label, ok, gone });
	}
	return results;
}
