import { isLocale } from '$lib/i18n/index.svelte';
import { getSetting } from '$lib/server/settings';
import type { AnimeTitle } from '$lib/titles.svelte';
import type { LayoutServerLoad } from './$types';

// Makes the logged-in user and the display settings available to all pages.
export const load: LayoutServerLoad = ({ locals }) => {
	const locale = getSetting('uiLanguage');
	const animeTitle: AnimeTitle = getSetting('animeTitle') === 'romaji' ? 'romaji' : 'english';
	return { user: locals.user, locale: isLocale(locale) ? locale : 'en', animeTitle };
};
