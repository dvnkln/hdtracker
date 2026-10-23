import { fail, redirect } from '@sveltejs/kit';
import type { Person } from '#lib/avatar.js';
import {
	hiddenServices,
	setServiceHidden,
	streamingAreas,
	streamingOrder,
	streamingOverview
} from '#lib/server/streaming.js';
import { isStreamingOrder } from '#lib/streamingOrder.js';
import { serverMessages } from '#lib/server/i18n.js';
import { setUserSettings } from '#lib/server/settings.js';
import { companionsByItem, pendingByItem, shareablePeople } from '#lib/server/sharing.js';
import type { Actions, PageServerLoad } from './$types';

// What one wants to watch, by streaming service. The titles are changed in the bottom sheet
// with the actions of their area page (/movies?/save …); this page only remembers the order
// and which services are hidden.
export const load: PageServerLoad = ({ locals }) => {
	const me = locals.user!.id;
	// Only movies, series and anime have streaming services: without them, nothing to show here
	if (streamingAreas(me).length === 0) redirect(303, '/');
	const companions = companionsByItem(me);
	return {
		...streamingOverview(me),
		order: streamingOrder(me),
		hidden: hiddenServices(me),
		// For the posters (who tracks along) and the bottom sheet (bell, inviting)
		together: Object.fromEntries(companions) as Record<number, Person[]>,
		people: shareablePeople(me),
		pending: pendingByItem(me)
	};
};

export const actions: Actions = {
	// The order of the tiles (A–Z or most titles first), remembered per account
	order: async ({ request, locals }) => {
		const order = (await request.formData()).get('order');
		if (!isStreamingOrder(order)) return fail(400, { error: serverMessages().common.invalidData });
		setUserSettings(locals.user!.id, { streamingOrder: order });
	},
	// Hides a service on this page or shows it again, remembered per account
	hide: async ({ request, locals }) => {
		const data = await request.formData();
		const key = data.get('key');
		const hidden = data.get('hidden');
		if (typeof key !== 'string' || !key || key.length > 100 || (hidden !== '1' && hidden !== '0')) {
			return fail(400, { error: serverMessages().common.invalidData });
		}
		setServiceHidden(locals.user!.id, key, hidden === '1');
	}
};
