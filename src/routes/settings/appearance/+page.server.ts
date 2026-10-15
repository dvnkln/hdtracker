import { fail } from '@sveltejs/kit';
import { serverMessages } from '#lib/server/i18n.js';
import { setUserSettings } from '#lib/server/settings.js';
import { rememberTheme, savedTheme } from '#lib/server/theme.js';
import { isTheme } from '#lib/themes.js';
import type { Actions, PageServerLoad } from './$types';

// Personal: the colour theme.
export const load: PageServerLoad = ({ locals }) => ({ theme: savedTheme(locals.user!.id) });

export const actions: Actions = {
	// Saves the theme; it is also remembered on this device for the login page.
	theme: async ({ request, cookies, url, locals }) => {
		const theme = (await request.formData()).get('theme');
		if (!isTheme(theme)) {
			return fail(400, { section: 'theme', error: serverMessages().common.invalidData });
		}
		setUserSettings(locals.user!.id, { theme });
		rememberTheme(cookies, request, url, theme);
		return { section: 'theme', message: serverMessages().settings.saved };
	}
};
