import { eq } from 'drizzle-orm';
import { getDb } from './db';
import { settings } from './db/schema';
import { CATEGORY_KEYS, isCategory, type Category } from '$lib/categories';

// Default values, used until the user changes them on the settings page.
const DEFAULTS = {
	uiLanguage: 'en', // interface language: 'en' | 'de'
	language: 'en-US', // content language for TMDB (titles, descriptions)
	region: 'US', // streaming offers and release dates
	animeTitle: 'english', // main anime title: 'english' | 'romaji' (the other one is shown below)
	hideSpoilers: 'on', // blur stills and descriptions of unwatched episodes: 'on' | 'off'
	autoStatus: 'on', // change the status automatically when episodes are ticked: 'on' | 'off'
	backupKeep: '7', // how many backup files to keep
	categories: 'movies,series,anime,games', // areas shown in the app (comma-separated)
	// Order of the dashboard lists: 'asc' | 'desc'. Personal, like uiLanguage or animeTitle:
	// with several users these move to the user.
	dashboardRecent: 'desc', // newest first
	dashboardUpcoming: 'asc' // next first
} as const;

export type SettingKey = keyof typeof DEFAULTS;

export function getSetting(key: SettingKey): string {
	const row = getDb().select().from(settings).where(eq(settings.key, key)).get();
	return row?.value ?? DEFAULTS[key];
}

// Saves several settings at once.
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

// Areas switched on in the settings (at least one). Hidden areas keep their data but are not
// shown, searched or refreshed.
export function enabledCategories(): Category[] {
	const list = getSetting('categories')
		.split(',')
		.filter((c): c is Category => isCategory(c));
	return list.length ? CATEGORY_KEYS.filter((c) => list.includes(c)) : [...CATEGORY_KEYS];
}
