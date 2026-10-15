import { fail, redirect } from '@sveltejs/kit';
import { MIN_PASSWORD_LENGTH } from '#lib/limits.js';
import { SESSION_COOKIE, deleteOtherSessions } from '#lib/server/auth.js';
import { serverMessages } from '#lib/server/i18n.js';
import { setOwnPassword } from '#lib/server/users.js';
import type { Actions } from './$types';

// The first page after logging in with a temporary password (a new account, or one an admin
// reset): choose a password of your own. Everything else leads here until then, see
// hooks.server.ts.
export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const t = serverMessages().auth;
		const data = await request.formData();
		const password = String(data.get('password') ?? '');
		if (password.length < MIN_PASSWORD_LENGTH) {
			return fail(400, { error: t.passwordTooShort(MIN_PASSWORD_LENGTH) });
		}
		if (password !== String(data.get('confirm') ?? '')) {
			return fail(400, { error: t.passwordsDiffer });
		}
		const user = locals.user!;
		await setOwnPassword(user.id, password);
		deleteOtherSessions(user.id, cookies.get(SESSION_COOKIE) ?? '');
		redirect(303, '/');
	}
};
