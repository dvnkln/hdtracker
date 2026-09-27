import { Film, Gamepad2, Sparkles, Tv } from '@lucide/svelte';
import type { Category } from './status';

// The four areas of the app. The key is also the URL (/movies, /series, ...); names are in i18n.
export const CATEGORIES = {
	movies: { accent: '#ef4444', icon: Film },
	series: { accent: '#3b82f6', icon: Tv },
	anime: { accent: '#ec4899', icon: Sparkles },
	games: { accent: '#22c55e', icon: Gamepad2 }
} as const satisfies Record<Category, unknown>;

export type { Category } from './status';

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export function isCategory(value: string): value is Category {
	return Object.hasOwn(CATEGORIES, value);
}
