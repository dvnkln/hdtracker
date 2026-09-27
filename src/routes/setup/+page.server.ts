import { isHttps } from '$lib/server/origins';
import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { createSession, hasAnyUser, hashPassword, setSessionCookie } from '$lib/server/auth';
import { serverMessages } from '$lib/server/i18n';
import { MIN_PASSWORD_LENGTH as MIN_PASSWORD } from '$lib/limits';
import type { Actions } from './$types';

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/;

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
			.values({ username, passwordHash })
			.returning({ id: users.id })
			.get();

		const { token, expiresAt } = createSession(user.id);
		setSessionCookie(cookies, isHttps(request, url), token, expiresAt);
		redirect(303, '/');
	}
};
