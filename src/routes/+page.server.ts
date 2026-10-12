import { fail } from '@sveltejs/kit';
import { isDashboardSection, isOrder } from '$lib/dashboardOrder';
import { getDashboard } from '$lib/server/dashboard';
import { serverMessages } from '$lib/server/i18n';
import { markRead } from '$lib/server/notices';
import { companionsByItem } from '$lib/server/sharing';
import { setUserSettings } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

// Dashboard: recent and upcoming releases of planned and current titles.
export const load: PageServerLoad = ({ locals }) => ({
	...getDashboard(locals.user!.id),
	// Who tracks a title along (by the title's number), for the profile pictures in the rows
	together: Object.fromEntries(companionsByItem(locals.user!.id))
});

export const actions: Actions = {
	// The dashboard is on screen: what it lists as released counts as read in the inbox.
	seen: ({ locals }) => {
		markRead(locals.user!.id, 'release');
	},
	// Remembers the order of one of the two lists.
	order: async ({ request, locals }) => {
		const data = await request.formData();
		const section = data.get('section');
		const order = data.get('order');
		if (!isDashboardSection(section) || !isOrder(order)) {
			return fail(400, { error: serverMessages().common.invalidData });
		}
		setUserSettings(
			locals.user!.id,
			section === 'recent' ? { dashboardRecent: order } : { dashboardUpcoming: order }
		);
	}
};
