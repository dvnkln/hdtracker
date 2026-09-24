import type { ParamMatcher } from '@sveltejs/kit';
import { isCategory } from '$lib/categories';

// Only /filme, /serien, /anime and /spiele match the [category=category] route.
export const match: ParamMatcher = (param) => isCategory(param);
