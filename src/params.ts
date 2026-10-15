import { defineParams } from '@sveltejs/kit/params';
import type { Category } from '#lib/status.js';

// Only /movies, /series, /anime and /games match the [category=category] route. SvelteKit
// loads this file with plain Node while building, so it cannot import #lib/categories (that
// file brings the icons, which only the bundler can load) – params.test.ts keeps both lists
// equal.
export const ROUTE_CATEGORIES: readonly Category[] = ['movies', 'series', 'anime', 'games'];

export const params = defineParams({
	category: (param) => (ROUTE_CATEGORIES.includes(param as Category) ? param : undefined)
});
