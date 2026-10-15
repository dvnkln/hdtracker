import { fail } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/auth.js';
import { serverMessages } from '#lib/server/i18n.js';
import { getSetting, setSettings } from '#lib/server/settings.js';
import {
	createUser,
	deleteUser,
	listUsers,
	resetPassword,
	setDisabled,
	setRole
} from '#lib/server/users.js';
import type { Actions, PageServerLoad } from './$types';

// Administration: the accounts of this installation. Only admins get here (see the layout of
// this group); every action checks again, because actions are not covered by it.
export const load: PageServerLoad = ({ locals }) => ({
	me: locals.user!.id,
	users: listUsers().map((user) => ({
		...user,
		lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
		createdAt: user.createdAt.toISOString()
	})),
	customTargets: getSetting('customTargets') === 'all'
});

const idOf = (data: FormData) => {
	const id = Number(data.get('id'));
	return Number.isInteger(id) && id > 0 ? id : 0;
};

export const actions: Actions = {
	// A new account. The answer carries its temporary password – shown once, never again.
	create: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const t = serverMessages().users;
		const data = await request.formData();
		const username = String(data.get('username') ?? '');
		const role = data.get('admin') === 'on' ? 'admin' : 'user';
		const result = await createUser(username, role, locals.user!.id);
		if (!result.ok) return fail(400, { error: t.errors[result.error] });
		return { created: { id: result.id, username: username.trim(), password: result.password } };
	},

	// A new temporary password for somebody who forgot theirs; logs them out everywhere.
	reset: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const t = serverMessages().users;
		const id = idOf(await request.formData());
		const result = await resetPassword(id);
		if (!result.ok) return fail(400, { error: t.errors[result.error] });
		const username = listUsers().find((user) => user.id === id)?.username ?? '';
		return { created: { id, username, password: result.password } };
	},

	role: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const data = await request.formData();
		const result = setRole(idOf(data), data.get('admin') === 'on' ? 'admin' : 'user');
		if (!result.ok) return fail(400, { error: serverMessages().users.errors[result.error] });
		return {};
	},

	lock: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const data = await request.formData();
		const result = setDisabled(idOf(data), data.get('locked') === 'on', locals.user!.id);
		if (!result.ok) return fail(400, { error: serverMessages().users.errors[result.error] });
		return {};
	},

	// Deletes the account with its library. Needs the username typed in, like emptying a library.
	delete: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const t = serverMessages().users;
		const data = await request.formData();
		const id = idOf(data);
		const user = listUsers().find((entry) => entry.id === id);
		if (!user) return fail(400, { error: t.errors.unknown });
		if (String(data.get('confirm') ?? '').trim() !== user.username) {
			return fail(400, { error: t.confirmWrong(user.username) });
		}
		const result = deleteUser(id, locals.user!.id);
		if (!result.ok) return fail(400, { error: t.errors[result.error] });
		return { message: t.deleted(user.username) };
	},

	// Whether everybody may add webhook and ntfy targets, or admins only.
	customTargets: async ({ request, locals }) => {
		requireAdmin(locals.user);
		const data = await request.formData();
		setSettings({ customTargets: data.get('customTargets') === 'on' ? 'all' : 'admins' });
		return {};
	}
};
