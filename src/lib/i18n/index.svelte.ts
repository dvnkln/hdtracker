import type { Category, Status } from '$lib/status';
import { de, type Messages } from './de';
import { en } from './en';

export type Locale = 'de' | 'en';
export const LOCALES: Locale[] = ['en', 'de'];
export const MESSAGES: Record<Locale, Messages> = { de, en };

export function isLocale(value: string): value is Locale {
	return (LOCALES as string[]).includes(value);
}

// The interface language is one global setting (stored in the DB), set by the root layout.
const current = $state({ locale: 'en' as Locale });

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

// ISO time -> "27.09.2026, 03:00" / "09/27/2026, 03:00 AM"
export function formatDateTime(iso: string) {
	return new Intl.DateTimeFormat(m.locale, {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(iso));
}

// 1536000 -> "1,5 MB" / "1.5 MB"
export function formatFileSize(bytes: number) {
	const [value, unit] =
		bytes >= 1e9
			? [bytes / 1e9, 'gigabyte']
			: bytes >= 1e6
				? [bytes / 1e6, 'megabyte']
				: bytes === 0
					? [0, 'kilobyte']
					: [Math.max(bytes / 1e3, 0.1), 'kilobyte'];
	return new Intl.NumberFormat(m.locale, {
		style: 'unit',
		unit,
		maximumFractionDigits: 1
	}).format(value);
}

// 12 -> "12 ms", 1540 -> "1,5 s" / "1.5 s"
export function formatDuration(ms: number) {
	const [value, unit] = ms < 1000 ? [Math.max(ms, 1), 'millisecond'] : [ms / 1000, 'second'];
	return new Intl.NumberFormat(m.locale, {
		style: 'unit',
		unit,
		unitDisplay: 'short',
		maximumFractionDigits: 1
	}).format(value);
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
