import { isHttps } from '$lib/server/origins';
import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import {
	clearLoginFailures,
	clientAddress,
	createSession,
	loginLockedFor,
	recordLoginFailure,
	setSessionCookie,
	verifyDummy,
	verifyPassword
} from '$lib/server/auth';
import { localeOf, rememberLocale, serverMessages } from '$lib/server/i18n';
import { rememberTheme, savedTheme } from '$lib/server/theme';
import { recordLogin } from '$lib/server/users';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async (event) => {
		const { request, cookies, url } = event;
		const ip = clientAddress(event);
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
		// Only told to whoever knows the password
		if (user.disabled) {
			return fail(403, { username, error: serverMessages().auth.accountLocked });
		}
		recordLogin(user.id);
		const { token, expiresAt } = createSession(user.id);
		setSessionCookie(cookies, isHttps(request, url), token, expiresAt);
		// The login page of this device follows the account from now on
		rememberTheme(cookies, request, url, savedTheme(user.id));
		rememberLocale(cookies, request, url, localeOf(user.id));
		redirect(303, '/');
	}
};
