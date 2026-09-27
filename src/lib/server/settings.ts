import { eq } from 'drizzle-orm';
import { getDb } from './db';
import { settings } from './db/schema';

// Default values, used until the user changes them on the settings page.
const DEFAULTS = {
	uiLanguage: 'en', // interface language: 'en' | 'de'
	language: 'en-US', // content language for TMDB (titles, descriptions)
	region: 'US' // streaming offers and release dates
} as const;

export type SettingKey = keyof typeof DEFAULTS;

export function getSetting(key: SettingKey): string {
	const row = getDb().select().from(settings).where(eq(settings.key, key)).get();
	return row?.value ?? DEFAULTS[key];
}
