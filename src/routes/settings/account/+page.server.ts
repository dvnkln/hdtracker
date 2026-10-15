import { fail, type RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { MIN_PASSWORD_LENGTH as MIN_PASSWORD, USERNAME_PATTERN } from '#lib/limits.js';
import {
	SESSION_COOKIE,
	clearLoginFailures,
	clientAddress,
	deleteOtherSessions,
	loginLockedFor,
	recordLoginFailure,
	verifyPassword
} from '#lib/server/auth.js';
import { getDb } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import { serverMessages } from '#lib/server/i18n.js';
import {
	MAX_AVATAR_BYTES,
	MAX_DISPLAY_NAME,
	nameInUse,
	removeAvatar,
	rerollColor,
	setAvatar,
	setDisplayName,
	setOwnPassword,
	toPerson
} from '#lib/server/users.js';
import type { Actions, PageServerLoad } from './$types';

// Personal: who you are for the others (name, picture) and how you log in.
export const load: PageServerLoad = ({ locals }) => {
	const user = locals.user!;
	return {
		me: toPerson({
			id: user.id,
			username: user.username,
			displayName: user.displayName,
			avatarColor: user.avatarColor,
			avatarUpdatedAt: user.avatarVersion === null ? null : new Date(user.avatarVersion)
		}),
		displayName: user.displayName ?? '',
		maxDisplayName: MAX_DISPLAY_NAME
	};
};

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
	// The name others see. Empty: the username is shown.
	profile: async ({ request, locals }) => {
		const t = serverMessages();
		const name = String((await request.formData()).get('displayName') ?? '');
		const result = setDisplayName(locals.user!.id, name);
		if (!result.ok) return fail(400, { section: 'profile', error: t.users.errors[result.error] });
		return { section: 'profile', message: t.settings.saved };
	},

	// A profile picture, sent by the page after it shrank the chosen photo.
	avatar: async ({ request, locals }) => {
		const t = serverMessages();
		const file = (await request.formData()).get('picture');
		if (!(file instanceof File) || file.size === 0 || file.size > MAX_AVATAR_BYTES) {
			return fail(400, { section: 'avatar', error: t.users.errors.picture });
		}
		const result = await setAvatar(locals.user!.id, new Uint8Array(await file.arrayBuffer()));
		if (!result.ok) return fail(400, { section: 'avatar', error: t.users.errors[result.error] });
		return { section: 'avatar' };
	},

	avatarRemove: ({ locals }) => {
		removeAvatar(locals.user!.id);
		return { section: 'avatar' };
	},

	// Another colour for the placeholder picture.
	color: ({ locals }) => {
		rerollColor(locals.user!.id);
		return { section: 'avatar' };
	},

	username: async (event) => {
		const t = serverMessages();
		const data = await event.request.formData();
		const username = String(data.get('username') ?? '').trim();
		const failWith = (error: string) => fail(400, { section: 'username', username, error });

		if (!USERNAME_PATTERN.test(username)) return failWith(t.auth.usernameRule);
		const wrong = await checkCurrentPassword(event, String(data.get('current') ?? ''));
		if (wrong) return failWith(wrong);

		const me = event.locals.user!.id;
		if (nameInUse(username, me)) return failWith(t.settings.usernameTaken);

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
		await setOwnPassword(user.id, password);
		deleteOtherSessions(user.id, event.cookies.get(SESSION_COOKIE) ?? '');
		return { section: 'password', message: t.settings.passwordChanged };
	},

	logoutOthers: async ({ locals, cookies }) => {
		const count = deleteOtherSessions(locals.user!.id, cookies.get(SESSION_COOKIE) ?? '');
		return { section: 'logoutOthers', message: serverMessages().settings.loggedOutOthers(count) };
	}
};
