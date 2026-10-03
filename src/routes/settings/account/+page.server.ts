import { fail, type RequestEvent } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import { MIN_PASSWORD_LENGTH as MIN_PASSWORD, USERNAME_PATTERN } from '$lib/limits';
import {
	SESSION_COOKIE,
	clearLoginFailures,
	clientAddress,
	deleteOtherSessions,
	hashPassword,
	loginLockedFor,
	recordLoginFailure,
	verifyPassword
} from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { serverMessages } from '$lib/server/i18n';
import type { Actions } from './$types';

// Checks the current password (with the same brute-force protection as the login form).
// Returns an error text, or null if the password is right.
async function checkCurrentPassword(event: RequestEvent, password: string) {
	const t = serverMessages();
	const ip = clientAddress(event);
	const locked = loginLockedFor(ip);
	if (locked > 0) return t.auth.tooManyAttempts(locked);
	const row = getDb().select().from(users).where(eq(users.id, event.locals.user!.id)).get();
	if (!row || !(await verifyPassword(password, row.passwordHash))) {
		recordLoginFailure(ip);
		return t.settings.wrongPassword;
	}
	clearLoginFailures(ip);
	return null;
}

export const actions: Actions = {
	username: async (event) => {
		const t = serverMessages();
		const data = await event.request.formData();
		const username = String(data.get('username') ?? '').trim();
		const failWith = (error: string) => fail(400, { section: 'username', username, error });

		if (!USERNAME_PATTERN.test(username)) return failWith(t.auth.usernameRule);
		const wrong = await checkCurrentPassword(event, String(data.get('current') ?? ''));
		if (wrong) return failWith(wrong);

		const me = event.locals.user!.id;
		const taken = getDb()
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.username, username), ne(users.id, me)))
			.get();
		if (taken) return failWith(t.settings.usernameTaken);

		getDb().update(users).set({ username }).where(eq(users.id, me)).run();
		return { section: 'username', message: t.settings.usernameChanged };
	},

	password: async (event) => {
		const t = serverMessages();
		const data = await event.request.formData();
		const password = String(data.get('password') ?? '');
		const failWith = (error: string) => fail(400, { section: 'password', error });

		const wrong = await checkCurrentPassword(event, String(data.get('current') ?? ''));
		if (wrong) return failWith(wrong);
		if (password.length < MIN_PASSWORD) return failWith(t.auth.passwordTooShort(MIN_PASSWORD));
		if (password !== String(data.get('confirm') ?? '')) return failWith(t.auth.passwordsDiffer);

		const user = event.locals.user!;
		const passwordHash = await hashPassword(password);
		getDb().update(users).set({ passwordHash }).where(eq(users.id, user.id)).run();
		deleteOtherSessions(user.id, event.cookies.get(SESSION_COOKIE) ?? '');
		return { section: 'password', message: t.settings.passwordChanged };
	},

	logoutOthers: async ({ locals, cookies }) => {
		const count = deleteOtherSessions(locals.user!.id, cookies.get(SESSION_COOKIE) ?? '');
		return { section: 'logoutOthers', message: serverMessages().settings.loggedOutOthers(count) };
	}
};
