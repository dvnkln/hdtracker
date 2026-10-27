import { fail } from '@sveltejs/kit';
import { serverMessages } from '#lib/server/i18n.js';
import { animeFactsOf, trailersOf } from '#lib/server/itemDetails.js';
import { invitationCards } from '#lib/server/invitationCards.js';
import { allItems } from '#lib/server/library.js';
import { clearRead, listNotices, markRead } from '#lib/server/notices.js';
import {
	acceptAll,
	declineAll,
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
	// The seasons of one anime series from the same person are one card (invitationCards.ts)
	const facts = animeFactsOf(
		invitations.filter((i) => i.item.category === 'anime').map((i) => i.item.id)
	);
	const cards = invitationCards(invitations, facts);
	const itemOf = new Map(invitations.map((i) => [i.id, i.item.id]));
	return {
		incoming: cards.map(({ ids, lead, status, seasons }) => ({
			ids,
			item: lead.item,
			from: lead.from,
			status,
			seasons,
			// Set if the user tracks a title of it already: accepting replaces that state
			own: ids.map((id) => mine.get(itemOf.get(id)!)).find((own) => own !== undefined) ?? null,
			trailerUrl: trailers.get(lead.item.id) ?? null
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

// The invitations of one card (one, or the seasons of a series)
async function invitationIds(request: Request) {
	const ids = (await request.formData()).getAll('id').map(Number);
	return ids.length > 0 && ids.length <= 100 && ids.every((id) => Number.isInteger(id) && id > 0)
		? ids
		: null;
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
	// Answering a card: all its invitations, one message to the person who invited
	accept: async ({ request, locals }) => {
		const ids = await invitationIds(request);
		if (ids === null) return fail(400, { error: serverMessages().common.invalidData });
		const failed = acceptAll(locals.user!.id, ids).find((result) => !result.ok);
		return failed && !failed.ok ? refused(failed.error) : { done: true };
	},
	decline: async ({ request, locals }) => {
		const ids = await invitationIds(request);
		if (ids === null) return fail(400, { error: serverMessages().common.invalidData });
		const failed = declineAll(locals.user!.id, ids).find((result) => !result.ok);
		return failed && !failed.ok ? refused(failed.error) : { done: true };
	},
	withdraw: async ({ request, locals }) => {
		const id = await invitationId(request);
		if (id === null) return fail(400, { error: serverMessages().common.invalidData });
		const result = withdraw(locals.user!.id, id);
		return result.ok ? { done: true } : refused(result.error);
	}
};
