import type { Person } from '#lib/avatar.js';
import { enabledCategories, getUserSetting } from '#lib/server/settings.js';
import { countOpen } from '#lib/server/notices.js';
import { shownName } from '#lib/server/users.js';
import type { AnimeTitle } from '#lib/titles.svelte.js';
import type { LayoutServerLoad } from './$types';

// Makes the logged-in user and the display settings available to all pages.
export const load: LayoutServerLoad = ({ locals, url, depends }) => {
	// The number at the bell is asked for again with every change of page, and when a page
	// reports that its notices were seen (see seen.ts).
	void url.pathname;
	depends('app:inbox');
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
		// The inbox: unread notices plus invitations waiting for an answer
		open: me === undefined ? 0 : countOpen(me),
		locale: locals.locale,
		animeTitle,
		// Marking of titles tracked together (see TogetherMark.svelte)
		sharedMarker:
			me !== undefined && getUserSetting(me, 'sharedMarker') === 'subtle' ? 'subtle' : 'pictures',
		// Logged out (login page, first-run wizard): no navigation is shown
		categories: me === undefined ? [] : enabledCategories(me)
	};
};
