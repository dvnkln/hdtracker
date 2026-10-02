import { fail } from '@sveltejs/kit';
import { serverMessages } from '$lib/server/i18n';
import { setSettings } from '$lib/server/settings';
import { rememberTheme, savedTheme } from '$lib/server/theme';
import { isTheme } from '$lib/themes';
import type { Actions, PageServerLoad } from './$types';

// Personal: the colour theme.
export const load: PageServerLoad = () => ({ theme: savedTheme() });

export const actions: Actions = {
	// Saves the theme; it is also remembered on this device for the login page.
	theme: async ({ request, cookies, url }) => {
		const theme = (await request.formData()).get('theme');
		if (!isTheme(theme)) {
			return fail(400, { section: 'theme', error: serverMessages().common.invalidData });
		}
		setSettings({ theme });
		rememberTheme(cookies, request, url, theme);
		return { section: 'theme', message: serverMessages().settings.saved };
	}
};
