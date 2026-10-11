import { and, eq } from 'drizzle-orm';
import { getDb } from './db';
import { settings, userSettings, users } from './db/schema';
import { CATEGORY_KEYS, isCategory, type Category } from '$lib/categories';

// Settings of the whole installation (changed by an admin), with the values used until
// somebody changes them.
const DEFAULTS = {
	language: 'en-US', // content language for TMDB (titles, descriptions)
	region: 'US', // streaming offers and release dates
	backupKeep: '7', // how many backup files to keep
	// Episode titles and texts for anime from TMDB ('on' | 'off'), and when the list that says
	// which TMDB season belongs to an AniList entry was last downloaded (see animeMapping.ts)
	animeEpisodeTitles: 'on',
	animeMappingAt: '',
	animeMappingVersion: '', // MAPPING_VERSION of the code that read the stored list
	// Key pair of this installation for push notifications (VAPID), created on first use. The
	// public part goes to the browsers, the private part signs every message (see push.ts).
	vapidPublicKey: '',
	vapidPrivateKey: '',
	// Reverse proxies whose X-Forwarded-For header is believed (see proxy.ts): addresses or
	// ranges, comma-separated. Empty = none.
	trustedProxies: '',
	// Secret a reverse proxy sends to prove itself where addresses do not help (see proxy.ts)
	proxyKey: '',
	// Who may add notification targets with an address of their own choice (webhook, ntfy):
	// 'admins' | 'all'. Such a target makes the server send requests to that address – also
	// into the network it runs in.
	customTargets: 'admins'
} as const;

// What every user sets for themselves, with the values a new account starts with.
const USER_DEFAULTS = {
	uiLanguage: 'en', // interface language: 'en' | 'de'
	theme: 'system', // colour theme, see $lib/themes ('system' follows the device)
	animeTitle: 'english', // main anime title: 'english' | 'romaji' (the other one is shown below)
	hideSpoilers: 'on', // blur stills and descriptions of unwatched episodes: 'on' | 'off'
	autoStatus: 'on', // change the status automatically when episodes are ticked: 'on' | 'off'
	categories: 'movies,series,anime,games', // areas shown in the app (comma-separated)
	// Order of the dashboard lists: 'asc' | 'desc'
	dashboardRecent: 'desc', // newest first
	dashboardUpcoming: 'asc', // next first
	// Notifications about new releases (read in one place, prefsFor() in notifications.ts).
	// 'off' | 'single' (one message per title) | 'digest' (one message a day)
	notifyMode: 'off',
	notifyHour: '9', // from this hour of the day on (0–23) the day's messages are sent
	notifyFrom: '' // day the messages were switched on: nothing older is announced
} as const;

export type SettingKey = keyof typeof DEFAULTS;
export type UserSettingKey = keyof typeof USER_DEFAULTS;

export function getSetting(key: SettingKey): string {
	const row = getDb().select().from(settings).where(eq(settings.key, key)).get();
	return row?.value ?? DEFAULTS[key];
}

// Saves several settings of the installation at once.
export function setSettings(values: Partial<Record<SettingKey, string>>) {
	getDb().transaction((tx) => {
		for (const [key, value] of Object.entries(values)) {
			tx.insert(settings)
				.values({ key, value })
				.onConflictDoUpdate({ target: settings.key, set: { value } })
				.run();
		}
	});
}

export function getUserSetting(userId: number, key: UserSettingKey): string {
	const row = getDb()
		.select()
		.from(userSettings)
		.where(and(eq(userSettings.userId, userId), eq(userSettings.key, key)))
		.get();
	return row?.value ?? USER_DEFAULTS[key];
}

// Saves several of a user's own settings at once.
export function setUserSettings(userId: number, values: Partial<Record<UserSettingKey, string>>) {
	getDb().transaction((tx) => {
		for (const [key, value] of Object.entries(values)) {
			tx.insert(userSettings)
				.values({ userId, key, value })
				.onConflictDoUpdate({ target: [userSettings.userId, userSettings.key], set: { value } })
				.run();
		}
	});
}

const asCategories = (text: string): Category[] => {
	const list = text.split(',').filter((c): c is Category => isCategory(c));
	return list.length ? CATEGORY_KEYS.filter((c) => list.includes(c)) : [...CATEGORY_KEYS];
};

// Areas the user has switched on (at least one). Hidden areas keep their data but are not
// shown or searched.
export function enabledCategories(userId: number): Category[] {
	return asCategories(getUserSetting(userId, 'categories'));
}

// Areas at least one user has switched on: these are kept up to date. An area nobody shows
// is not refreshed.
export function shownCategories(): Category[] {
	const db = getDb();
	const everybody = db.select({ id: users.id }).from(users).all();
	if (everybody.length === 0) return [...CATEGORY_KEYS];
	const shown = new Set(everybody.flatMap(({ id }) => enabledCategories(id)));
	return CATEGORY_KEYS.filter((c) => shown.has(c));
}
