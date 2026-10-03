import type { Handle, RequestEvent, ServerInit } from '@sveltejs/kit';
import { runMigrations } from '$lib/server/db';
import {
	SESSION_COOKIE,
	clearSessionCookie,
	getSecret,
	hasAnyUser,
	setSessionCookie,
	validateSession
} from '$lib/server/auth';
import { allowedOrigins, isAllowedOrigin, isHttps } from '$lib/server/origins';
import { getSetting } from '$lib/server/settings';
import { themeFor } from '$lib/server/theme';
import { barColors } from '$lib/themes';
import { startScheduler } from '$lib/server/tasks/scheduler';

// Runs once when the server starts, before the first request is handled.
export const init: ServerInit = () => {
	getSecret(); // fail fast if SECRET is missing
	if (allowedOrigins().length === 0 && process.env.NODE_ENV === 'production') {
		console.warn('ORIGIN is not set in .env – login and all forms will fail (HTTP 403).');
	}
	runMigrations();
	console.log('Database migrations applied');
	startScheduler(); // background tasks (backup, cleanup, ...)
};

// Pages reachable without being logged in.
const PUBLIC_PATHS = ['/health', '/login', '/setup'];

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

function redirectTo(location: string) {
	return new Response(null, { status: 303, headers: { location } });
}

// Sent with every answer: no embedding in other pages, no guessing of file types, and the
// address of a page is not passed on to other sites. (What the browser may load at all is
// set in vite.config.ts, `csp`.)
const SECURITY_HEADERS = {
	'X-Frame-Options': 'DENY',
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'same-origin'
};

export const handle: Handle = async (input) => {
	const response = await respond(input);
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
	return response;
};

// Runs for every request: checks the origin of form posts, loads the logged-in user and
// redirects to /setup or /login if needed.
const respond: Handle = async ({ event, resolve }) => {
	const { url, request } = event;
	const path = url.pathname;
	if (path === '/health') return resolve(event);

	if (!SAFE_METHODS.includes(request.method)) {
		if (!isAllowedOrigin(request.headers.get('origin'), url)) {
			return new Response('Cross-site POST form submissions are forbidden', { status: 403 });
		}
	}

	event.locals.user = null;
	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const session = validateSession(token);
		if (session) {
			event.locals.user = session.user;
			if (session.renewedUntil) {
				setSessionCookie(event.cookies, isHttps(request, url), token, session.renewedUntil);
			}
		} else {
			clearSessionCookie(event.cookies);
		}
	}

	// No admin yet: everything leads to the first-run wizard.
	if (!hasAnyUser()) {
		return path === '/setup' ? resolveWithLang(event, resolve) : redirectTo('/setup');
	}
	if (path === '/setup') return redirectTo('/');

	if (!event.locals.user && !PUBLIC_PATHS.includes(path)) return redirectTo('/login');
	if (event.locals.user && path === '/login') return redirectTo('/');

	return resolveWithLang(event, resolve);
};

// Fills in the placeholders of app.html: interface language and colour theme (set on the
// server, so a page never flashes in the wrong theme while loading).
function resolveWithLang(event: RequestEvent, resolve: Parameters<Handle>[0]['resolve']) {
	const lang = getSetting('uiLanguage');
	const theme = themeFor(event);
	const [dark, light] = barColors(theme);
	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html
				.replace('%lang%', lang)
				.replace('%theme%', theme)
				.replace('%themeColor%', dark)
				.replace('%themeColorLight%', light)
	});
}
