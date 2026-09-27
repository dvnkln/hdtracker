import type { Category, Status } from '$lib/status';
import { de, type Messages } from './de';
import { en } from './en';

export type Locale = 'de' | 'en';
export const LOCALES: Locale[] = ['de', 'en'];
export const MESSAGES: Record<Locale, Messages> = { de, en };

export function isLocale(value: string): value is Locale {
	return (LOCALES as string[]).includes(value);
}

// The interface language is one global setting (stored in the DB), set by the root layout.
const current = $state({ locale: 'de' as Locale });

export function setLocale(locale: Locale) {
	current.locale = locale;
}

// Texts in the current language, e.g. m.detail.similar. Reading through this keeps pages
// reactive: they re-render when the language changes.
export const m = new Proxy({} as Messages, {
	get: (_, key) => MESSAGES[current.locale][key as keyof Messages]
});

export function statusLabel(category: Category, status: Status) {
	return m.statusLabels[category]?.[status] ?? status;
}

// "2026-10-03" -> "03.10.2026" / "10/03/2026"
export function formatDate(iso: string) {
	return new Intl.DateTimeFormat(m.locale, {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	}).format(new Date(`${iso.slice(0, 10)}T00:00:00`));
}

// "2026-10-03" -> "03.10." / "10/03"
export function formatShortDate(iso: string) {
	return new Intl.DateTimeFormat(m.locale, { day: '2-digit', month: '2-digit' }).format(
		new Date(`${iso.slice(0, 10)}T00:00:00`)
	);
}

// 147 -> "2 Std. 27 Min." / "2 h 27 min"
export function formatRuntime(minutes: number) {
	const h = Math.floor(minutes / 60);
	return h ? m.units.hoursMinutes(h, minutes % 60) : m.units.minutes(minutes);
}

// 8.1 -> "8,1" / "8.1"
export function formatRating(value: number) {
	return value.toLocaleString(m.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
