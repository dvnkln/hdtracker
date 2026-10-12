import { describe, expect, it } from 'vitest';
import { NOTHING, pickAll, pickOne, pickRange } from './selection';

// Ten posters in a row
const order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const sorted = (ids: number[]) => [...ids].sort((a, b) => a - b);

describe('selecting posters', () => {
	it('a range hangs on the poster picked before it: it grows and shrinks', () => {
		let selection = pickOne(NOTHING, 4);
		selection = pickRange(selection, order, 8);
		expect(sorted(selection.chosen)).toEqual([4, 5, 6, 7, 8]);
		// Shift+click further back: only up to there
		selection = pickRange(selection, order, 6);
		expect(sorted(selection.chosen)).toEqual([4, 5, 6]);
		// ... or to the other side of where it began
		selection = pickRange(selection, order, 2);
		expect(sorted(selection.chosen)).toEqual([2, 3, 4]);
	});

	it('keeps what was selected before the range began', () => {
		let selection = pickOne(NOTHING, 1);
		selection = pickOne(selection, 5); // Ctrl+click: the new anchor
		selection = pickRange(selection, order, 9);
		expect(sorted(selection.chosen)).toEqual([1, 5, 6, 7, 8, 9]);
		selection = pickRange(selection, order, 6);
		expect(sorted(selection.chosen)).toEqual([1, 5, 6]);
	});

	it('one more or one less; taking the last one away leaves nothing', () => {
		let selection = pickOne(NOTHING, 3);
		selection = pickOne(selection, 7);
		expect(selection.chosen).toEqual([3, 7]);
		selection = pickOne(pickOne(selection, 3), 7);
		expect(selection.chosen).toEqual([]);
	});

	it('a range without a starting point in sight is a single pick', () => {
		expect(pickRange(NOTHING, order, 5).chosen).toEqual([5]);
		// The anchor sits in a section that was folded since
		const hidden = pickOne(NOTHING, 42);
		expect(sorted(pickRange(hidden, order, 5).chosen)).toEqual([5, 42]);
	});

	it('everything one can see', () => {
		expect(pickAll([3, 1, 2]).chosen).toEqual([3, 1, 2]);
	});
});
