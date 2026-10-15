import { fail } from '@sveltejs/kit';
import { serverMessages } from '#lib/server/i18n.js';
import { trailersOf } from '#lib/server/itemDetails.js';
import { allItems } from '#lib/server/library.js';
import { clearRead, listNotices, markRead } from '#lib/server/notices.js';
import {
	accept,
	decline,
	incoming,
	outgoing,
	withdraw,
	type SharingError
} from '#lib/server/sharing.js';
import type { Actions, PageServerLoad } from './$types';

// The inbox: invitations waiting for an answer, what was released and what others did with
// titles tracked together, and the invitations the user sent themselves.
export const load: PageServerLoad = ({ locals }) => {
	const me = locals.user!.id;
	const mine = new Map(allItems(me).map((item) => [item.id, item.status]));
	const invitations = incoming(me);
	// A trailer to look at before answering, where the title has one
	const trailers = trailersOf(invitations.map((invitation) => invitation.item.id));
	return {
		incoming: invitations.map(({ id, item, from, status }) => ({
			id,
			item,
			from,
			status,
			// Set if the user tracks the title already: accepting replaces that state
			own: mine.get(item.id) ?? null,
			trailerUrl: trailers.get(item.id) ?? null
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
	// The bin next to "News": removes what was read. Whatever is on the page counts as read
	// (it is on screen), also if the report of that has not arrived yet.
	clear: ({ locals }) => {
		markRead(locals.user!.id);
		clearRead(locals.user!.id);
		return { done: true };
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
