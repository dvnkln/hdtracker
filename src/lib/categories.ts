import { Film, Gamepad2, Sparkles, Tv } from '@lucide/svelte';

// The four areas of the app. The key is also the URL (/filme, /serien, ...).
export const CATEGORIES = {
	filme: { label: 'Filme', accent: '#ef4444', icon: Film },
	serien: { label: 'Serien', accent: '#3b82f6', icon: Tv },
	anime: { label: 'Anime', accent: '#ec4899', icon: Sparkles },
	spiele: { label: 'Spiele', accent: '#22c55e', icon: Gamepad2 }
} as const;

export type Category = keyof typeof CATEGORIES;

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export function isCategory(value: string): value is Category {
	return value in CATEGORIES;
}
