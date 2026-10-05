import type { Outgoing } from '../channels';

// A webhook: the message is POSTed to an address the user chose, with a body they wrote –
// placeholders like {{title}} are filled in. That reaches ntfy, Gotify, Home Assistant and
// whatever else takes such a request, without hdtracker knowing any of them.
//
// The address is the user's choice and usually points into their own network, so private
// addresses are not refused (that would defeat the purpose). With a single account that is
// harmless: the owner calls their own services. ONCE THERE ARE SEVERAL USERS, webhooks must
// be limited to admins or restricted – otherwise any user could make the server send
// requests into the network it runs in.

const TIMEOUT_MS = 10_000;
export const MAX_URL_LENGTH = 2000;
export const MAX_BODY_LENGTH = 4000;
export const MAX_HEADER_LENGTH = 1000;

export type WebhookConfig = {
	url: string;
	// What is sent, with {{placeholders}}
	body: string;
	// Optional extra header line, e.g. "Authorization: Bearer abc" (may hold a secret)
	header: string;
};

export const DEFAULT_BODY = `{
  "title": "{{title}}",
  "message": "{{message}}",
  "url": "{{url}}"
}`;
export const PLACEHOLDERS = ['title', 'message', 'url', 'image', 'count', 'test'] as const;
type Values = Record<(typeof PLACEHOLDERS)[number], string>;

export function isWebhookUrl(text: string) {
	if (text.length > MAX_URL_LENGTH) return false;
	try {
		const url = new URL(text);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

// "Name: value" → [name, value]; null if it is not a header line. No line breaks (they would
// allow smuggling in further headers).
export function parseHeader(line: string): [string, string] | null {
	const match = /^([A-Za-z0-9!#$%&'*+.^_`|~-]+):[ \t]*([^\r\n]*)$/.exec(line.trim());
	return match && match[2] ? [match[1], match[2]] : null;
}

// Fills the placeholders in. A template that looks like JSON gets its values escaped for
// JSON, so a quote or line break in a title cannot break it. Unknown placeholders stay as
// they are. `json` says whether the result is valid JSON (decides the content type).
export function renderTemplate(template: string, values: Values) {
	const looksLikeJson = /^\s*[{[]/.test(template);
	const escape = (value: string) => (looksLikeJson ? JSON.stringify(value).slice(1, -1) : value);
	const body = template.replace(/\{\{\s*([a-z]+)\s*\}\}/g, (whole, name: string) =>
		name in values ? escape(values[name as keyof Values]) : whole
	);
	let json = false;
	if (looksLikeJson) {
		try {
			JSON.parse(body);
			json = true;
		} catch {
			// sent as plain text then
		}
	}
	return { body, json };
}

// Sends one message. Never throws; `error` says why it did not work.
export async function sendWebhook(config: WebhookConfig, message: Outgoing) {
	const { body, json } = renderTemplate(config.body, {
		title: message.title,
		message: message.body,
		url: message.link ?? '',
		image: message.image ?? '',
		count: String(message.count),
		test: String(message.test)
	});
	const headers: Record<string, string> = {
		'Content-Type': json ? 'application/json' : 'text/plain; charset=utf-8'
	};
	const extra = parseHeader(config.header);
	if (extra) headers[extra[0]] = extra[1];
	try {
		const res = await fetch(config.url, {
			method: 'POST',
			headers,
			body,
			// A redirect could lead somewhere the user never entered
			redirect: 'manual',
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (res.ok) return { ok: true as const };
		const answer = (await res.text().catch(() => '')).trim().slice(0, 200);
		return { ok: false as const, error: `HTTP ${res.status}${answer ? ` – ${answer}` : ''}` };
	} catch {
		return { ok: false as const, error: 'unreachable' };
	}
}
