import type { Outgoing } from '../channels';
import { isWebhookUrl } from './webhook';

// ntfy (ntfy.sh, or a server of one's own): a message is published to a topic; whoever
// subscribed to that topic in the ntfy app gets it. Unlike a webhook, the picture is sent
// along as a file – so it arrives even where the phone cannot reach hdtracker. The icon,
// however, is only an address the phone loads by itself.
//
// Like a webhook, the server is the user's choice and may be in their own network. ONCE
// THERE ARE SEVERAL USERS the same limit as for webhooks applies (see webhook.ts).

const TIMEOUT_MS = 10_000;
export const DEFAULT_SERVER = 'https://ntfy.sh';
export const MAX_TOKEN_LENGTH = 200;
// ntfy's default limit for an attachment (also what ntfy.sh allows without an account)
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export type NtfyConfig = {
	server: string; // without the topic, no slash at the end
	topic: string;
	// Access token for a protected topic ("tk_…"); empty if the topic is open
	token: string;
	// Address of the icon shown next to the message; empty = the one of this hdtracker
	icon: string;
	picture: boolean;
};

// ntfy's own rule for topic names
export const isNtfyTopic = (text: string) => /^[-_A-Za-z0-9]{1,64}$/.test(text);
export const isNtfyToken = (text: string) =>
	text.length <= MAX_TOKEN_LENGTH && /^[A-Za-z0-9_.~+/=-]+$/.test(text);
// "https://ntfy.example.com/" → "https://ntfy.example.com"; null if it is no such address
export function cleanServer(text: string) {
	const server = text.trim().replace(/\/+$/, '');
	return isWebhookUrl(server) && !/[?#]/.test(server) ? server : null;
}

// A header may only hold plain characters; ntfy reads everything else in this wrapping
// (RFC 2047) – umlauts, dashes, emoji and line breaks arrive as they are.
const encoded = (text: string) => `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;

type Answer = { error?: string };
async function publish(
	config: NtfyConfig,
	message: Outgoing,
	file: Uint8Array<ArrayBuffer> | null
) {
	const headers: Record<string, string> = { Title: encoded(message.title) };
	if (config.token) headers.Authorization = `Bearer ${config.token}`;
	if (message.link) headers.Click = message.link;
	if (config.icon) headers.Icon = config.icon;
	// With a file the text travels in a header, without one it is the content itself
	if (file) {
		headers.Message = encoded(message.body);
		headers.Filename = 'picture.jpg';
	}
	const res = await fetch(`${config.server}/${config.topic}`, {
		method: 'PUT',
		headers,
		body: file ?? message.body,
		// A redirect could lead somewhere the user never entered
		redirect: 'manual',
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});
	if (res.ok) return { ok: true as const, status: res.status };
	const text = await res.text().catch(() => '');
	let reason = '';
	try {
		reason = (JSON.parse(text) as Answer).error ?? '';
	} catch {
		// no JSON (e.g. a proxy in front of it): the status has to do
	}
	return {
		ok: false as const,
		status: res.status,
		error: `HTTP ${res.status}${reason ? ` – ${reason.slice(0, 200)}` : ''}`
	};
}

// Sends one message. Never throws; `error` says why it did not work.
export async function sendNtfy(config: NtfyConfig, message: Outgoing) {
	const settings = { ...config, icon: config.icon || message.icon || '' };
	const picture = config.picture ? await message.picture().catch(() => null) : null;
	const file =
		picture && picture.body.length <= MAX_IMAGE_BYTES ? new Uint8Array(picture.body) : null;
	try {
		const sent = await publish(settings, message, file);
		// The server takes no files (attachments are off by default on one's own server) or
		// not this one: the message matters more than its picture
		if (!sent.ok && file && (sent.status === 400 || sent.status === 413)) {
			return await publish(settings, message, null);
		}
		return sent;
	} catch {
		return { ok: false as const, error: 'unreachable' };
	}
}
