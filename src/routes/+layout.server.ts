import type { Person } from '$lib/avatar';
import { enabledCategories, getUserSetting } from '$lib/server/settings';
import { shownName } from '$lib/server/users';
import type { AnimeTitle } from '$lib/titles.svelte';
import type { LayoutServerLoad } from './$types';

// Makes the logged-in user and the display settings available to all pages.
export const load: LayoutServerLoad = ({ locals }) => {
	const user = locals.user;
	const me = user?.id;
	// How the logged-in user is shown in the header (name and picture as others see them)
	const person: Person | null = user
		? {
				id: user.id,
				name: shownName(user),
				color: user.avatarColor,
				picture: user.avatarVersion
			}
		: null;
	const animeTitle: AnimeTitle =
		me !== undefined && getUserSetting(me, 'animeTitle') === 'romaji' ? 'romaji' : 'english';
	return {
		user: locals.user,
		profile: person,
		locale: locals.locale,
		animeTitle,
		// Logged out (login page, first-run wizard): no navigation is shown
		categories: me === undefined ? [] : enabledCategories(me)
	};
};
