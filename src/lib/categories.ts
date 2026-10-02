import { Film, Gamepad2, Sparkles, Tv } from '@lucide/svelte';
import type { Category } from './status';

// The four areas of the app. The key is also the URL (/movies, /series, ...); names are in i18n.
// The accent colours are defined in routes/layout.css (red, blue, pink, green), so a theme can
// use a darker shade where the page is light. Use them in CSS only (style, not SVG attributes).
export const CATEGORIES = {
	movies: { accent: 'var(--accent-movies)', icon: Film },
	series: { accent: 'var(--accent-series)', icon: Tv },
	anime: { accent: 'var(--accent-anime)', icon: Sparkles },
	games: { accent: 'var(--accent-games)', icon: Gamepad2 }
} as const satisfies Record<Category, unknown>;

export type { Category } from './status';

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export function isCategory(value: string): value is Category {
	return Object.hasOwn(CATEGORIES, value);
}
