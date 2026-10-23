import { redirect } from '@sveltejs/kit';
import type { Person } from '#lib/avatar.js';
import { streamingAreas, streamingOverview } from '#lib/server/streaming.js';
import { companionsByItem, pendingByItem, shareablePeople } from '#lib/server/sharing.js';
import type { PageServerLoad } from './$types';

// What one wants to watch, by streaming service. The titles are changed in the bottom sheet
// with the actions of their area page (/movies?/save …), so this page has no actions itself.
export const load: PageServerLoad = ({ locals }) => {
	const me = locals.user!.id;
	// Only movies, series and anime have streaming services: without them, nothing to show here
	if (streamingAreas(me).length === 0) redirect(303, '/');
	const companions = companionsByItem(me);
	return {
		...streamingOverview(me),
		// For the posters (who tracks along) and the bottom sheet (bell, inviting)
		together: Object.fromEntries(companions) as Record<number, Person[]>,
		people: shareablePeople(me),
		pending: pendingByItem(me)
	};
};
