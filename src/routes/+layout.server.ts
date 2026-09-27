import { isLocale } from '$lib/i18n/index.svelte';
import { getSetting } from '$lib/server/settings';
import type { LayoutServerLoad } from './$types';

// Makes the logged-in user and the interface language available to all pages.
export const load: LayoutServerLoad = ({ locals }) => {
	const locale = getSetting('uiLanguage');
	return { user: locals.user, locale: isLocale(locale) ? locale : 'en' };
};
