import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { DEFAULT_THEME, isTheme, type Theme } from '$lib/themes';
import { isHttps } from './origins';
import { getSetting } from './settings';

// Remembers the theme last used on this device, so the login page can show it before anybody
// is logged in. Holds only the theme's name.
const THEME_COOKIE = 'hdtracker_theme';
const YEAR_SECONDS = 365 * 24 * 60 * 60;

// The theme chosen in the settings (personal, like the interface language).
export function savedTheme(): Theme {
	const theme = getSetting('theme');
	return isTheme(theme) ? theme : DEFAULT_THEME;
}

// The theme a page is drawn in: logged in -> the account's theme; logged out -> the one last
// used on this device, otherwise the theme of the installation.
export function themeFor(event: RequestEvent): Theme {
	if (event.locals.user) return savedTheme();
	const remembered = event.cookies.get(THEME_COOKIE);
	return isTheme(remembered) ? remembered : savedTheme();
}

// Called when the theme is changed and after logging in.
export function rememberTheme(cookies: Cookies, request: Request, url: URL, theme = savedTheme()) {
	cookies.set(THEME_COOKIE, theme, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isHttps(request, url),
		maxAge: YEAR_SECONDS
	});
}
