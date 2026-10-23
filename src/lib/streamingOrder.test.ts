import { describe, expect, it } from 'vitest';
import { isStreamingOrder, sortServices } from './streamingOrder';

const tile = (name: string, ids: number, purchase = 0) => ({
	name,
	ids: Array.from({ length: ids }, (_, i) => i),
	purchase: Array.from({ length: purchase }, (_, i) => i)
});
const names = (list: { name: string }[]) => list.map((s) => s.name);

describe('sortServices', () => {
	const tiles = [
		tile('WOW', 2),
		tile('apple TV', 0, 9),
		tile('Netflix', 5),
		tile('Disney Plus', 2, 1)
	];

	it('sorts A–Z by default, regardless of capitals', () => {
		expect(names(sortServices(tiles, 'name'))).toEqual([
			'apple TV',
			'Disney Plus',
			'Netflix',
			'WOW'
		]);
	});

	it('sorts by titles in the subscription, then to rent or buy, then A–Z', () => {
		expect(names(sortServices(tiles, 'count'))).toEqual([
			'Netflix',
			'Disney Plus',
			'WOW',
			'apple TV'
		]);
	});

	it('leaves the list it was given as it was', () => {
		sortServices(tiles, 'count');
		expect(names(tiles)).toEqual(['WOW', 'apple TV', 'Netflix', 'Disney Plus']);
	});

	it('knows the two orders and nothing else', () => {
		expect(isStreamingOrder('name')).toBe(true);
		expect(isStreamingOrder('count')).toBe(true);
		expect(isStreamingOrder('desc')).toBe(false);
		expect(isStreamingOrder(null)).toBe(false);
	});
});
