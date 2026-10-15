import { describe, expect, it } from 'vitest';
import { CATEGORY_KEYS } from '#lib/categories.js';
import { ROUTE_CATEGORIES } from './params';

describe('route matcher', () => {
	it('knows exactly the areas of the app', () => {
		expect([...ROUTE_CATEGORIES].sort()).toEqual([...CATEGORY_KEYS].sort());
	});
});
