import { enabledCategories, getUserSetting } from '$lib/server/settings';
import type { AnimeTitle } from '$lib/titles.svelte';
import type { LayoutServerLoad } from './$types';

// Makes the logged-in user and the display settings available to all pages.
export const load: LayoutServerLoad = ({ locals }) => {
	const me = locals.user?.id;
	const animeTitle: AnimeTitle =
		me !== undefined && getUserSetting(me, 'animeTitle') === 'romaji' ? 'romaji' : 'english';
	return {
		user: locals.user,
		locale: locals.locale,
		animeTitle,
		// Logged out (login page, first-run wizard): no navigation is shown
		categories: me === undefined ? [] : enabledCategories(me)
	};
};
