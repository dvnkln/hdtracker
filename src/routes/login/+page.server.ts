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
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
		const ip = getClientAddress();
		const data = await request.formData();
		const username = String(data.get('username') ?? '').trim();
		const password = String(data.get('password') ?? '');

		const locked = loginLockedFor(ip);
		if (locked > 0) {
			return fail(429, { username, error: `Zu viele Fehlversuche. Bitte ${locked} s warten.` });
		}

		const user = getDb().select().from(users).where(eq(users.username, username)).get();
		const ok = user
			? await verifyPassword(password, user.passwordHash)
			: await verifyDummy(password);

		if (!user || !ok) {
			recordLoginFailure(ip);
			return fail(400, { username, error: 'Benutzername oder Passwort falsch' });
		}

		clearLoginFailures(ip);
		const { token, expiresAt } = createSession(user.id);
		setSessionCookie(cookies, url, token, expiresAt);
		redirect(303, '/');
	}
};
