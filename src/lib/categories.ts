import { Film, Gamepad2, Sparkles, Tv } from '@lucide/svelte';
import type { Category } from './status';

// The four areas of the app. The key is also the URL (/filme, /serien, ...).
export const CATEGORIES = {
	filme: { label: 'Filme', accent: '#ef4444', icon: Film },
	serien: { label: 'Serien', accent: '#3b82f6', icon: Tv },
	anime: { label: 'Anime', accent: '#ec4899', icon: Sparkles },
	spiele: { label: 'Spiele', accent: '#22c55e', icon: Gamepad2 }
} as const satisfies Record<Category, unknown>;

export type { Category } from './status';

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export function isCategory(value: string): value is Category {
	return Object.hasOwn(CATEGORIES, value);
}
