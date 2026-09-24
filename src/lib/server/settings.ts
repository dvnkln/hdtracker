import { eq } from 'drizzle-orm';
import { getDb } from './db';
import { settings } from './db/schema';

// Default values, used until the user changes them on the settings page.
const DEFAULTS = {
	language: 'de-DE',
	region: 'DE'
} as const;

export type SettingKey = keyof typeof DEFAULTS;

export function getSetting(key: SettingKey): string {
	const row = getDb().select().from(settings).where(eq(settings.key, key)).get();
	return row?.value ?? DEFAULTS[key];
}
