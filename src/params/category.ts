import type { ParamMatcher } from '@sveltejs/kit';
import { isCategory } from '$lib/categories';

// Only /movies, /series, /anime and /games match the [category=category] route.
export const match: ParamMatcher = (param) => isCategory(param);
