import type { Handle, ServerInit } from '@sveltejs/kit';
import { runMigrations } from '$lib/server/db';
import {
	SESSION_COOKIE,
	clearSessionCookie,
	deleteExpiredSessions,
	getSecret,
	hasAnyUser,
	setSessionCookie,
	validateSession
} from '$lib/server/auth';

// Runs once when the server starts, before the first request is handled.
export const init: ServerInit = () => {
	getSecret(); // fail fast if SECRET is missing
	runMigrations();
	deleteExpiredSessions();
	console.log('Database migrations applied');
};

// Pages reachable without being logged in.
const PUBLIC_PATHS = ['/health', '/login', '/setup'];

function redirectTo(location: string) {
	return new Response(null, { status: 303, headers: { location } });
}

// Runs for every request: loads the logged-in user and redirects to /setup or /login if needed.
export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	if (path === '/health') return resolve(event);

	event.locals.user = null;
	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const session = validateSession(token);
		if (session) {
			event.locals.user = session.user;
			if (session.renewedUntil) {
				setSessionCookie(event.cookies, event.url, token, session.renewedUntil);
			}
		} else {
			clearSessionCookie(event.cookies);
		}
	}

	// No admin yet: everything leads to the first-run wizard.
	if (!hasAnyUser()) {
		return path === '/setup' ? resolve(event) : redirectTo('/setup');
	}
	if (path === '/setup') return redirectTo('/');

	if (!event.locals.user && !PUBLIC_PATHS.includes(path)) return redirectTo('/login');
	if (event.locals.user && path === '/login') return redirectTo('/');

	return resolve(event);
};
