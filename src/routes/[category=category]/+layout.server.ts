import { redirect } from '@sveltejs/kit';
import { isCategory } from '#lib/categories.js';
import { enabledCategories } from '#lib/server/settings.js';
import type { LayoutServerLoad } from './$types';

// Areas the user has hidden in the settings are not reachable: back to the dashboard.
export const load: LayoutServerLoad = ({ params, locals }) => {
	const { category } = params;
	if (!isCategory(category) || !enabledCategories(locals.user!.id).includes(category))
		redirect(303, '/');
};
