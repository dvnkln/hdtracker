import { fail } from '@sveltejs/kit';
import { isCategory } from '#lib/categories.js';
import { isLocale } from '#lib/i18n/index.svelte.js';
import { countByCategory } from '#lib/server/library.js';
import { refreshPending } from '#lib/server/releases.js';
import { rememberLocale, serverMessages } from '#lib/server/i18n.js';
import { enabledCategories, getUserSetting, setUserSettings } from '#lib/server/settings.js';
import { canShare } from '#lib/server/sharing.js';
import type { Actions, PageServerLoad } from './$types';

// Personal preferences: how hdtracker looks and behaves.
export const load: PageServerLoad = ({ locals }) => ({
	values: {
		uiLanguage: locals.locale,
		animeTitle: getUserSetting(locals.user!.id, 'animeTitle'),
		hideSpoilers: getUserSetting(locals.user!.id, 'hideSpoilers') === 'on',
		sharedMarker: getUserSetting(locals.user!.id, 'sharedMarker'),
		autoStatus: getUserSetting(locals.user!.id, 'autoStatus') === 'on'
	},
	// The marking of shared titles can only be chosen while there is somebody to share with
	canShare: canShare(locals.user!.id),
	// Entries per area (hint when an area with entries is hidden)
	libraryCounts: countByCategory(locals.user!.id)
});

export const actions: Actions = {
	display: async ({ request, cookies, url, locals }) => {
		const data = await request.formData();
		const uiLanguage = String(data.get('uiLanguage') ?? '');
		const animeTitle = String(data.get('animeTitle') ?? '');
		if (!isLocale(uiLanguage) || (animeTitle !== 'english' && animeTitle !== 'romaji')) {
			return fail(400, { section: 'display', error: serverMessages().common.invalidData });
		}
		const hideSpoilers = data.get('hideSpoilers') === 'on' ? 'on' : 'off';
		// (Only sent while there is somebody to share with – otherwise it stays as it is.)
		const marker = data.get('sharedMarker');
		const sharedMarker =
			marker === 'pictures' || marker === 'subtle' ? { sharedMarker: marker } : {};
		setUserSettings(locals.user!.id, { uiLanguage, animeTitle, hideSpoilers, ...sharedMarker });
		// The login page of this device follows the account
		rememberLocale(cookies, request, url, uiLanguage);
		return { section: 'display', message: serverMessages().settings.saved };
	},

	behavior: async ({ request, locals }) => {
		const data = await request.formData();
		setUserSettings(locals.user!.id, {
			autoStatus: data.get('autoStatus') === 'on' ? 'on' : 'off'
		});
		return { section: 'behavior', message: serverMessages().settings.saved };
	},

	// Areas shown in the app. Titles of an area that is switched on again, which never got their
	// details (e.g. imported while hidden), are loaded now.
	areas: async ({ request, locals }) => {
		const t = serverMessages().settings;
		const chosen = (await request.formData()).getAll('categories').map(String).filter(isCategory);
		if (chosen.length === 0) return fail(400, { section: 'areas', error: t.areasMin });
		const before = enabledCategories(locals.user!.id);
		setUserSettings(locals.user!.id, { categories: chosen.join(',') });
		if (chosen.some((c) => !before.includes(c))) refreshPending();
		return { section: 'areas', message: t.saved };
	}
};
