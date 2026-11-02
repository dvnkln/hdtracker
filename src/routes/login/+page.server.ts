import { isHttps } from '#lib/server/origins.js';
import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import {
	checkPasswordGuarded,
	clientAddress,
	createSession,
	setSessionCookie,
	verifyDummy,
	verifyPassword
} from '#lib/server/auth.js';
import { localeOf, rememberLocale, serverMessages } from '#lib/server/i18n.js';
import { rememberTheme, savedTheme } from '#lib/server/theme.js';
import { recordLogin } from '#lib/server/users.js';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async (event) => {
		const { request, cookies, url } = event;
		const ip = clientAddress(event);
		const data = await request.formData();
		const username = String(data.get('username') ?? '').trim();
		const password = String(data.get('password') ?? '');

		// (The account is only looked up once the address may try: a locked one costs nothing.)
		let user: typeof users.$inferSelect | undefined;
		const checked = await checkPasswordGuarded(ip, () => {
			user = getDb().select().from(users).where(eq(users.username, username)).get();
			return user ? verifyPassword(password, user.passwordHash) : verifyDummy(password);
		});
		if (checked.result === 'locked') {
			return fail(429, { username, error: serverMessages().auth.tooManyAttempts(checked.seconds) });
		}
		if (!user || checked.result === 'wrong') {
			return fail(400, { username, error: serverMessages().auth.wrongCredentials });
		}

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
