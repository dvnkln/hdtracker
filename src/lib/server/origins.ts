// ORIGIN in .env may list several addresses, comma-separated; start.js keeps the list in
// HDTRACKER_ORIGINS. (adapter-node no longer reads ORIGIN: without it, the address of a request
// is https://<Host header> – what counts for us is decided here.)
const list = (process.env.HDTRACKER_ORIGINS ?? process.env.ORIGIN ?? '')
	.split(',')
	.map((o) => o.trim().replace(/\/+$/, ''))
	.filter(Boolean);

export function allowedOrigins() {
	return list;
}

// Replaces SvelteKit's built-in CSRF check: form submissions must come from one of our addresses.
// Without any ORIGIN configured (dev server), the address the request came in on is used.
export function isAllowedOrigin(origin: string | null, url: URL) {
	if (!origin) return false;
	return list.length ? list.includes(origin) : origin === url.origin;
}

// Whether the browser reached us via https, based on the configured address matching the Host
// header. Decides the "secure" flag of the login cookie (secure cookies are dropped on http).
export function isHttps(request: Request, url: URL) {
	const host = request.headers.get('host');
	const match = list.find((o) => {
		try {
			return new URL(o).host === host;
		} catch {
			return false;
		}
	});
	return match ? match.startsWith('https:') : url.protocol === 'https:';
}
