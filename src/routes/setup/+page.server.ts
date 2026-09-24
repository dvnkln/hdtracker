import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { createSession, hasAnyUser, hashPassword, setSessionCookie } from '$lib/server/auth';
import type { Actions } from './$types';

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/;
const MIN_PASSWORD = 10;

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		// The wizard may only be used once.
		if (hasAnyUser()) redirect(303, '/login');

		const data = await request.formData();
		const username = String(data.get('username') ?? '').trim();
		const password = String(data.get('password') ?? '');
		const confirm = String(data.get('confirm') ?? '');

		if (!USERNAME_PATTERN.test(username)) {
			return fail(400, {
				username,
				error: 'Benutzername: 3–32 Zeichen, nur Buchstaben, Zahlen, _ . -'
			});
		}
		if (password.length < MIN_PASSWORD) {
			return fail(400, {
				username,
				error: `Passwort muss mindestens ${MIN_PASSWORD} Zeichen lang sein`
			});
		}
		if (password !== confirm) {
			return fail(400, { username, error: 'Passwörter stimmen nicht überein' });
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
		setSessionCookie(cookies, url, token, expiresAt);
		redirect(303, '/');
	}
};
