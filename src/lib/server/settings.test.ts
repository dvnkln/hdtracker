import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from './db';
import { userSettings, users } from './db/schema';
import { contentMessages, defaultLocale, localeOf, serverMessages, withLocale } from './i18n';
import {
	enabledCategories,
	getSetting,
	getUserSetting,
	setSettings,
	setUserSettings,
	shownCategories
} from './settings';
import { savedTheme } from './theme';

let anna: number;
let ben: number;
beforeEach(() => {
	const db = getDb();
	db.delete(users).run();
	const user = (username: string) =>
		db.insert(users).values({ username, passwordHash: 'x' }).returning().get().id;
	anna = user('anna');
	ben = user('ben');
});

describe('personal settings', () => {
	it('a new account starts with the defaults', () => {
		expect(getUserSetting(ben, 'uiLanguage')).toBe('en');
		expect(getUserSetting(ben, 'notifyMode')).toBe('off');
		expect(savedTheme(ben)).toBe('system');
		expect(enabledCategories(ben)).toEqual(['movies', 'series', 'anime', 'games']);
	});

	it('what one user changes stays with them', () => {
		setUserSettings(anna, { uiLanguage: 'de', theme: 'dracula', hideSpoilers: 'off' });
		setUserSettings(anna, { categories: 'movies' });
		expect(localeOf(anna)).toBe('de');
		expect(savedTheme(anna)).toBe('dracula');
		expect(getUserSetting(anna, 'hideSpoilers')).toBe('off');
		expect(enabledCategories(anna)).toEqual(['movies']);

		expect(localeOf(ben)).toBe('en');
		expect(savedTheme(ben)).toBe('system');
		expect(getUserSetting(ben, 'hideSpoilers')).toBe('on');
		expect(enabledCategories(ben)).toHaveLength(4);
	});

	it('are gone with the account', () => {
		setUserSettings(ben, { theme: 'dracula' });
		getDb().delete(users).run();
		expect(getDb().select().from(userSettings).all()).toEqual([]);
	});

	it('an area always stays switched on, whatever was stored', () => {
		setUserSettings(anna, { categories: '' });
		expect(enabledCategories(anna)).toHaveLength(4);
		setUserSettings(anna, { categories: 'nonsense,games' });
		expect(enabledCategories(anna)).toEqual(['games']);
	});
});

describe('what is kept up to date', () => {
	it('every area at least one user shows', () => {
		setUserSettings(anna, { categories: 'movies' });
		setUserSettings(ben, { categories: 'movies,games' });
		expect(shownCategories()).toEqual(['movies', 'games']);
	});
	it('everything while there is no account yet', () => {
		getDb().delete(users).run();
		expect(shownCategories()).toHaveLength(4);
	});
});

describe('the language of texts written on the server', () => {
	it('is that of whoever the work is for', () => {
		expect(withLocale('de', () => serverMessages().common.cancel)).toBe('Abbrechen');
		expect(withLocale('en', () => serverMessages().common.cancel)).toBe('Cancel');
	});
	it('stays the same across waiting', async () => {
		const later = (locale: 'de' | 'en') =>
			withLocale(locale, async () => {
				await new Promise((done) => setTimeout(done, 5));
				return serverMessages().common.cancel;
			});
		expect(await Promise.all([later('de'), later('en')])).toEqual(['Abbrechen', 'Cancel']);
	});
	it('is that of the first account where nobody in particular is addressed', () => {
		setUserSettings(ben, { uiLanguage: 'de' });
		expect(defaultLocale()).toBe('en');
		setUserSettings(anna, { uiLanguage: 'de' });
		expect(defaultLocale()).toBe('de');
		expect(serverMessages().common.cancel).toBe('Abbrechen');
	});
	it('words stored with the contents follow the content language, the same for everyone', () => {
		setSettings({ language: 'de-DE' });
		expect(withLocale('en', () => contentMessages().episodes.specials)).toBe(
			withLocale('de', () => contentMessages().episodes.specials)
		);
		setSettings({ language: 'en-US' });
		expect(getSetting('language')).toBe('en-US');
		expect(contentMessages().common.cancel).toBe('Cancel');
	});
});
