import { expect, it } from 'vitest';
import { evaluate, type Facts } from './health';

const fine: Facts = {
	https: true,
	connection: { forwarded: null, via: null, hidden: false },
	missingKeys: [],
	failedTasks: 0,
	pendingItems: 0,
	missingItems: []
};
const levels = (facts: Partial<Facts>) =>
	Object.fromEntries(evaluate({ ...fine, ...facts }).map((c) => [c.key, c.level]));

it('everything fine', () => {
	expect(new Set(Object.values(levels({})))).toEqual(new Set(['ok']));
});

it('plain http is only a hint', () => {
	expect(levels({ https: false }).https).toBe('hint');
});

it('reverse proxy: confirmed is fine, unconfirmed needs action', () => {
	const proxy = (connection: Facts['connection']) => levels({ connection }).proxy;
	expect(proxy({ forwarded: '203.0.113.7', via: 'key', hidden: true })).toBe('ok');
	expect(proxy({ forwarded: '203.0.113.7', via: 'address', hidden: false })).toBe('ok');
	expect(proxy({ forwarded: '203.0.113.7', via: null, hidden: false })).toBe('action');
	expect(proxy({ forwarded: '203.0.113.7', via: null, hidden: true })).toBe('action');
});

it('direct visitors sharing one address are a hint, not a problem', () => {
	expect(levels({ connection: { forwarded: null, via: null, hidden: true } }).proxy).toBe('hint');
});

it('missing keys and failed tasks need action, loading titles are a hint', () => {
	const checks = evaluate({ ...fine, missingKeys: ['IGDB'], failedTasks: 2, pendingItems: 7 });
	expect(checks.find((c) => c.key === 'sources')).toMatchObject({
		level: 'action',
		names: ['IGDB']
	});
	expect(checks.find((c) => c.key === 'tasks')).toMatchObject({ level: 'action', count: 2 });
	expect(checks.find((c) => c.key === 'library')).toMatchObject({ level: 'hint', count: 7 });
});

it('titles the data source no longer knows are listed as a hint', () => {
	const missingItems = [{ title: 'Gone', href: '/anime/1' }];
	expect(evaluate({ ...fine, missingItems }).find((c) => c.key === 'missing')).toMatchObject({
		level: 'hint',
		count: 1,
		items: missingItems
	});
});
