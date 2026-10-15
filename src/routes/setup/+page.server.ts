import { isHttps } from '#lib/server/origins.js';
import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import { createSession, hasAnyUser, hashPassword, setSessionCookie } from '#lib/server/auth.js';
import { localeOf, rememberLocale, serverMessages } from '#lib/server/i18n.js';
import { MIN_PASSWORD_LENGTH as MIN_PASSWORD, USERNAME_PATTERN } from '#lib/limits.js';
import { rememberTheme, savedTheme } from '#lib/server/theme.js';
import { randomHue } from '#lib/server/users.js';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		// The wizard may only be used once.
		if (hasAnyUser()) redirect(303, '/login');

		const data = await request.formData();
		const username = String(data.get('username') ?? '').trim();
		const password = String(data.get('password') ?? '');
		const confirm = String(data.get('confirm') ?? '');

		const t = serverMessages().auth;
		if (!USERNAME_PATTERN.test(username)) {
			return fail(400, { username, error: t.usernameRule });
		}
		if (password.length < MIN_PASSWORD) {
			return fail(400, { username, error: t.passwordTooShort(MIN_PASSWORD) });
		}
		if (password !== confirm) {
			return fail(400, { username, error: t.passwordsDiffer });
		}

		const passwordHash = await hashPassword(password);
		// Check again: another request could have created the admin while hashing.
		if (hasAnyUser()) redirect(303, '/login');
		const user = getDb()
			.insert(users)
			.values({
				username,
				passwordHash,
				role: 'admin',
				lastLoginAt: new Date(),
				avatarColor: randomHue()
			})
			.returning({ id: users.id })
			.get();

		const { token, expiresAt } = createSession(user.id);
		setSessionCookie(cookies, isHttps(request, url), token, expiresAt);
		// The login page of this device follows the account from now on
		rememberTheme(cookies, request, url, savedTheme(user.id));
		rememberLocale(cookies, request, url, localeOf(user.id));
		redirect(303, '/');
	}
};
