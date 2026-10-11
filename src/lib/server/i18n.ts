import { AsyncLocalStorage } from 'node:async_hooks';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { MESSAGES, isLocale, type Locale } from '$lib/i18n/index.svelte';
import { getDb } from './db';
import { users } from './db/schema';
import { isHttps } from './origins';
import { getSetting, getUserSetting } from './settings';

// Texts created on the server (form errors, API errors, notifications) are written in the
// language of whoever they are for. That language travels with the work instead of being
// passed through every function: a request runs in the language of its user (set in
// hooks.server.ts), a notification in the language of its receiver (`withLocale`). This is
// only about wording – whose data something is, is always passed explicitly.
const current = new AsyncLocalStorage<Locale>();

export function withLocale<T>(locale: Locale, work: () => T): T {
	return current.run(locale, work);
}

// The interface language a user chose.
export function localeOf(userId: number): Locale {
	const locale = getUserSetting(userId, 'uiLanguage');
	return isLocale(locale) ? locale : 'en';
}

// The language of the installation: that of its first account. Used where nobody in
// particular is addressed – the login page of a device nobody has logged in on yet, and
// results of background tasks shown under Maintenance.
export function defaultLocale(): Locale {
	const first = getDb().select({ id: users.id }).from(users).orderBy(users.id).limit(1).get();
	return first ? localeOf(first.id) : 'en';
}

// Texts in the language of whoever the current work is for (see above).
export function serverMessages(locale?: Locale) {
	return MESSAGES[locale ?? current.getStore() ?? defaultLocale()];
}

// Texts in the language of the contents (titles and descriptions from TMDB), for the few words
// that are stored together with them, e.g. the name of a season that has none. They are the
// same for everyone, like the contents themselves.
export function contentMessages() {
	return MESSAGES[getSetting('language').toLowerCase().startsWith('de') ? 'de' : 'en'];
}

// ---- Which language a page is shown in ----

// Remembers the language last used on this device, so the login page can use it before
// anybody is logged in. Holds only the language code.
const LOCALE_COOKIE = 'hdtracker_lang';
const YEAR_SECONDS = 365 * 24 * 60 * 60;

// Logged in -> the account's language; logged out -> the one last used on this device,
// otherwise the language of the installation.
export function localeFor(event: RequestEvent): Locale {
	if (event.locals.user) return localeOf(event.locals.user.id);
	const remembered = event.cookies.get(LOCALE_COOKIE) ?? '';
	return isLocale(remembered) ? remembered : defaultLocale();
}

// Called when the language is changed and after logging in.
export function rememberLocale(cookies: Cookies, request: Request, url: URL, locale: Locale) {
	cookies.set(LOCALE_COOKIE, locale, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: isHttps(request, url),
		maxAge: YEAR_SECONDS
	});
}
