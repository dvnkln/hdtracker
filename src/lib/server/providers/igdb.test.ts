import { expect, it } from 'vitest';
import { releaseState } from './igdb';

// Unix seconds of a day far in the past / in the future.
const PAST = Date.UTC(2020, 5, 15, 12) / 1000;
const LATER_PAST = Date.UTC(2022, 5, 15, 12) / 1000;
const FUTURE = Date.UTC(2099, 5, 15, 12) / 1000;
const game = (dates: { date?: number; status?: string }[], extra = {}) => ({
	id: 1,
	name: 'Game',
	release_dates: dates.map((d) => ({
		date: d.date,
		status: d.status ? { name: d.status } : undefined
	})),
	...extra
});

it('a game only out in early access', () => {
	const state = releaseState(game([{ date: PAST, status: 'Early Access' }]));
	expect(state.earlyAccess).toBe(true);
	expect(state.viaEarlyAccess).toBe(true);
	expect(state.current).toBe('2020-06-15');
	expect(state.fullDate).toBeNull();
});

it('early access with an announced full version', () => {
	const state = releaseState(game([{ date: PAST, status: 'Early Access' }, { date: FUTURE }]));
	expect(state.earlyAccess).toBe(true);
	expect(state.current).toBe('2020-06-15');
	expect(state.fullDate).toBe('2099-06-15');
	expect(state.playable).toBe('2020-06-15');
});

it('early access no longer matters once the full version is out', () => {
	const state = releaseState(game([{ date: PAST, status: 'Early Access' }, { date: LATER_PAST }]));
	expect(state.earlyAccess).toBe(false);
	expect(state.viaEarlyAccess).toBe(false);
	expect(state.current).toBe('2022-06-15');
	expect(state.playable).toBe('2020-06-15');
});

it('a normal release and an unannounced game', () => {
	expect(releaseState(game([{ date: PAST }])).current).toBe('2020-06-15');
	const open = releaseState(game([]));
	expect(open.current).toBeNull();
	expect(open.playable).toBeNull();
	expect(open.earlyAccess).toBe(false);
});

it('early access that has not started yet is not shown as early access', () => {
	const state = releaseState(game([{ date: FUTURE, status: 'Early Access' }]));
	expect(state.earlyAccess).toBe(false);
	expect(state.viaEarlyAccess).toBe(true);
	expect(state.playable).toBe('2099-06-15');
});
