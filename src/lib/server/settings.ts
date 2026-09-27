import { eq } from 'drizzle-orm';
import { getDb } from './db';
import { settings } from './db/schema';

// Default values, used until the user changes them on the settings page.
const DEFAULTS = {
	uiLanguage: 'en', // interface language: 'en' | 'de'
	language: 'en-US', // content language for TMDB (titles, descriptions)
	region: 'US', // streaming offers and release dates
	animeTitle: 'english', // main anime title: 'english' | 'romaji' (the other one is shown below)
	autoStatus: 'on', // change the status automatically when episodes are ticked: 'on' | 'off'
	backupKeep: '7' // how many backup files to keep
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
