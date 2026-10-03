import { expect, it } from 'vitest';
import { sortByDate } from './dashboardOrder';

const entries = [
	{ id: 'a', date: '2026-10-02' },
	{ id: 'open', date: null },
	{ id: 'b', date: '2026-10-05' },
	{ id: 'c', date: '2026-10-02' }
];
const ids = (list: typeof entries) => list.map((e) => e.id);

it('sorts ascending, same day keeps its order, open dates last', () => {
	expect(ids(sortByDate(entries, 'asc'))).toEqual(['a', 'c', 'b', 'open']);
});

it('sorts descending, open dates still last', () => {
	expect(ids(sortByDate(entries, 'desc'))).toEqual(['b', 'a', 'c', 'open']);
});
