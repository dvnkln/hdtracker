import { redirect } from '@sveltejs/kit';
import { isCategory } from '$lib/categories';
import { enabledCategories } from '$lib/server/settings';
import type { LayoutServerLoad } from './$types';

// Areas hidden in the settings are not reachable: back to the dashboard.
export const load: LayoutServerLoad = ({ params }) => {
	const { category } = params;
	if (!isCategory(category) || !enabledCategories().includes(category)) redirect(303, '/');
};
