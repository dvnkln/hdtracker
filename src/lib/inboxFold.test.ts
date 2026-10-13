import { describe, expect, it } from 'vitest';
import { FOLD, newsShown } from './inboxFold';

describe('folded news', () => {
	const read = (n: number) => Array<boolean>(n).fill(false);

	it('shows the first few of a long list that was read', () => {
		expect(newsShown(read(10))).toBe(FOLD);
		expect(newsShown(read(2))).toBe(FOLD); // a short list is simply shown whole
		expect(newsShown([])).toBe(FOLD);
	});

	it('never folds away something unread', () => {
		expect(newsShown([true, true, true, true, true, false, false])).toBe(5);
		// An unread one further down keeps everything above it visible too
		expect(newsShown([false, false, false, false, false, true, false])).toBe(6);
		expect(newsShown([true, false, false, false])).toBe(FOLD);
	});
});
