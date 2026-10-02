import { fail } from '@sveltejs/kit';
import { isDashboardSection, isOrder } from '$lib/dashboardOrder';
import { getDashboard } from '$lib/server/dashboard';
import { serverMessages } from '$lib/server/i18n';
import { setSettings } from '$lib/server/settings';
import type { Actions, PageServerLoad } from './$types';

// Dashboard: recent and upcoming releases of planned and current titles.
export const load: PageServerLoad = () => getDashboard();

export const actions: Actions = {
	// Remembers the order of one of the two lists.
	order: async ({ request }) => {
		const data = await request.formData();
		const section = data.get('section');
		const order = data.get('order');
		if (!isDashboardSection(section) || !isOrder(order)) {
			return fail(400, { error: serverMessages().common.invalidData });
		}
		setSettings(section === 'recent' ? { dashboardRecent: order } : { dashboardUpcoming: order });
	}
};
