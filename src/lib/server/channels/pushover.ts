import type { Outgoing } from '../channels';

// Pushover (pushover.net): a message goes to their API with the token of an application the
// user registered there and the user's own key; Pushover passes it on to the user's devices.
// Unlike the notifications of the app itself, Pushover can read what is sent.

const API = 'https://api.pushover.net/1';
const TIMEOUT_MS = 10_000;
// Pushover's limits
const MAX_TITLE = 250;
const MAX_MESSAGE = 1024;
const MAX_URL = 512;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type PushoverConfig = {
	token: string; // of the user's own application at Pushover
	user: string; // user (or group) key
	// Optional filter, exactly as Pushover takes it: one device name, or several with commas.
	// Empty = all devices of the account.
	devices: string;
	// Device names Pushover reported when the keys were checked (only offered as suggestions)
	known: string[];
	// Whether the picture of the title is attached (missing = yes: targets from before this
	// choice existed)
	picture?: boolean;
};

const KEY = /^[A-Za-z0-9]{30}$/;
export const isPushoverKey = (value: string) => KEY.test(value);
// Device names: letters, digits, _ and -, up to 25 characters each (Pushover's rule)
export const cleanDevices = (text: string) =>
	text
		.split(',')
		.map((name) => name.trim())
		.filter((name) => /^[A-Za-z0-9_-]{1,25}$/.test(name))
		.join(',');

const shorten = (text: string, max: number) =>
	text.length <= max ? text : `${text.slice(0, max - 1)}…`;

type Answer = { status?: number; errors?: string[]; devices?: string[] };
async function ask(path: string, body: FormData) {
	const res = await fetch(`${API}/${path}`, {
		method: 'POST',
		body,
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});
	let answer: Answer = {};
	try {
		answer = (await res.json()) as Answer;
	} catch {
		// no JSON: judged by the status below
	}
	const ok = res.ok && answer.status === 1;
	const reason = answer.errors?.join('; ') || `HTTP ${res.status}`;
	return { ok, reason, answer };
}

// Asks Pushover whether token and key belong together and work. Returns the names of the
// account's devices if Pushover reports them. `error` is Pushover's own wording.
export async function checkPushover(token: string, user: string) {
	const body = new FormData();
	body.set('token', token);
	body.set('user', user);
	try {
		const { ok, reason, answer } = await ask('users/validate.json', body);
		if (!ok) return { ok: false as const, error: reason };
		const devices = Array.isArray(answer.devices)
			? answer.devices.filter((d) => typeof d === 'string')
			: [];
		return { ok: true as const, devices };
	} catch {
		return { ok: false as const, error: 'unreachable' };
	}
}

// Sends one message. Never throws; `error` says why it did not work.
export async function sendPushover(config: PushoverConfig, message: Outgoing) {
	const body = new FormData();
	body.set('token', config.token);
	body.set('user', config.user);
	body.set('title', shorten(message.title, MAX_TITLE));
	body.set('message', shorten(message.body, MAX_MESSAGE));
	// Left out = all devices; a name Pushover does not know also means all
	if (config.devices) body.set('device', config.devices);
	if (message.link && message.link.length <= MAX_URL) {
		body.set('url', message.link);
		body.set('url_title', message.linkTitle);
	}
	const picture = config.picture === false ? null : await message.picture().catch(() => null);
	if (picture && picture.body.length <= MAX_IMAGE_BYTES) {
		const file = new Blob([new Uint8Array(picture.body)], { type: picture.type });
		body.set('attachment', file, 'picture.jpg');
	}
	try {
		const { ok, reason } = await ask('messages.json', body);
		return ok ? { ok: true as const } : { ok: false as const, error: reason };
	} catch {
		return { ok: false as const, error: 'unreachable' };
	}
}
