import { isHttps } from '$lib/server/origins';
import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import {
	clearLoginFailures,
	createSession,
	loginLockedFor,
	recordLoginFailure,
	setSessionCookie,
	verifyDummy,
	verifyPassword
} from '$lib/server/auth';
import { serverMessages } from '$lib/server/i18n';
import { rememberTheme } from '$lib/server/theme';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
		const ip = getClientAddress();
		const data = await request.formData();
		const username = String(data.get('username') ?? '').trim();
		const password = String(data.get('password') ?? '');

		const locked = loginLockedFor(ip);
		if (locked > 0) {
			return fail(429, { username, error: serverMessages().auth.tooManyAttempts(locked) });
		}

		const user = getDb().select().from(users).where(eq(users.username, username)).get();
		const ok = user
			? await verifyPassword(password, user.passwordHash)
			: await verifyDummy(password);

		if (!user || !ok) {
			recordLoginFailure(ip);
			return fail(400, { username, error: serverMessages().auth.wrongCredentials });
		}

		clearLoginFailures(ip);
		const { token, expiresAt } = createSession(user.id);
		setSessionCookie(cookies, isHttps(request, url), token, expiresAt);
		rememberTheme(cookies, request, url); // the login page of this device follows the account
		redirect(303, '/');
	}
};
