import { describe, expect, it } from 'vitest';
import { allowedStatuses, isReleased, isStatusFor, statusesFor } from './status';

describe('statuses per area', () => {
	it('movies cannot be "watching" or "paused"', () => {
		expect(statusesFor('movies')).toEqual(['planned', 'completed', 'dropped']);
		expect(isStatusFor('movies', 'active')).toBe(false);
		expect(isStatusFor('series', 'active')).toBe(true);
	});
});

describe('isReleased', () => {
	const today = '2026-10-03';
	it('is true on and after the release day', () => {
		expect(isReleased({ releaseDate: '2026-10-03' }, today)).toBe(true);
		expect(isReleased({ releaseDate: '2020-01-01' }, today)).toBe(true);
	});
	it('is false before the release day and without a date', () => {
		expect(isReleased({ releaseDate: '2026-10-04' }, today)).toBe(false);
		expect(isReleased({ releaseDate: null }, today)).toBe(false);
	});
	it('never locks a title its data source no longer knows', () => {
		const gone = {
			releaseDate: null,
			metadataUpdatedAt: new Date(),
			sourceMissingSince: new Date()
		};
		expect(isReleased(gone, today)).toBe(true);
	});
	it('never locks a title whose details are still loading', () => {
		expect(isReleased({ releaseDate: null, metadataUpdatedAt: null }, today)).toBe(true);
	});
});

describe('allowedStatuses', () => {
	it('allows only "planned" for unreleased titles', () => {
		expect(allowedStatuses('games', false)).toEqual(['planned']);
		expect(allowedStatuses('games', true)).toEqual(statusesFor('games'));
	});
});
