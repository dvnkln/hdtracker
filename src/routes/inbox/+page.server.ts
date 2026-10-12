import { fail } from '@sveltejs/kit';
import { serverMessages } from '$lib/server/i18n';
import { allItems } from '$lib/server/library';
import { listNotices, markRead } from '$lib/server/notices';
import {
	accept,
	decline,
	incoming,
	outgoing,
	withdraw,
	type SharingError
} from '$lib/server/sharing';
import type { Actions, PageServerLoad } from './$types';

// The inbox: invitations waiting for an answer, what was released and what others did with
// titles tracked together, and the invitations the user sent themselves.
export const load: PageServerLoad = ({ locals }) => {
	const me = locals.user!.id;
	const mine = new Map(allItems(me).map((item) => [item.id, item.status]));
	return {
		incoming: incoming(me).map(({ id, item, from, status }) => ({
			id,
			item,
			from,
			status,
			// Set if the user tracks the title already: accepting replaces that state
			own: mine.get(item.id) ?? null
		})),
		notices: listNotices(me),
		outgoing: outgoing(me).map(({ id, item, to }) => ({ id, item, to }))
	};
};

const refused = (error: SharingError) => fail(400, { error: serverMessages().share.errors[error] });

async function invitationId(request: Request) {
	const id = Number((await request.formData()).get('id'));
	return Number.isInteger(id) && id > 0 ? id : null;
}

export const actions: Actions = {
	// The page is on screen: everything on it counts as read.
	seen: ({ locals }) => {
		markRead(locals.user!.id);
	},
	accept: async ({ request, locals }) => {
		const id = await invitationId(request);
		if (id === null) return fail(400, { error: serverMessages().common.invalidData });
		const result = accept(locals.user!.id, id);
		return result.ok ? { done: true } : refused(result.error);
	},
	decline: async ({ request, locals }) => {
		const id = await invitationId(request);
		if (id === null) return fail(400, { error: serverMessages().common.invalidData });
		const result = decline(locals.user!.id, id);
		return result.ok ? { done: true } : refused(result.error);
	},
	withdraw: async ({ request, locals }) => {
		const id = await invitationId(request);
		if (id === null) return fail(400, { error: serverMessages().common.invalidData });
		const result = withdraw(locals.user!.id, id);
		return result.ok ? { done: true } : refused(result.error);
	}
};
