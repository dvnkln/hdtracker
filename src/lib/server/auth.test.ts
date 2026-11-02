import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
	blockedAddresses,
	checkPasswordGuarded,
	createSession,
	deleteExpiredSessions,
	deleteOtherSessions,
	hashPassword,
	lockKey,
	loginLockedFor,
	pruneLoginFailures,
	recordLoginFailure,
	validateSession,
	verifyPassword
} from './auth';
import { getDb } from './db';
import { users } from './db/schema';

const DAY = 24 * 60 * 60 * 1000;
let userId: number;
beforeAll(async () => {
	const user = getDb()
		.insert(users)
		.values({ username: 'demo', passwordHash: await hashPassword('correct horse') })
		.returning()
		.get();
	userId = user.id;
});
afterEach(() => vi.useRealTimers());

describe('passwords', () => {
	it('accepts the right password only', async () => {
		const hash = await hashPassword('correct horse');
		expect(hash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
		expect(await verifyPassword('correct horse', hash)).toBe(true);
		expect(await verifyPassword('wrong', hash)).toBe(false);
	});
	it('never stores the same hash twice', async () => {
		expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
	});
});

describe('sessions', () => {
	it('finds the user for a valid token only', () => {
		const { token } = createSession(userId);
		expect(validateSession(token)?.user).toMatchObject({
			id: userId,
			username: 'demo',
			role: 'user',
			mustChangePassword: false,
			displayName: null,
			avatarVersion: null
		});
		expect(validateSession('made-up-token')).toBeNull();
	});
	it('ends after 30 days without use', () => {
		const { token } = createSession(userId);
		vi.useFakeTimers({ now: Date.now() + 31 * DAY });
		expect(validateSession(token)).toBeNull();
	});
	it('is extended when used in its second half', () => {
		const { token } = createSession(userId);
		vi.useFakeTimers({ now: Date.now() + 20 * DAY });
		expect(validateSession(token)?.renewedUntil).not.toBeNull();
		vi.setSystemTime(Date.now() + 25 * DAY); // 45 days after login
		expect(validateSession(token)).not.toBeNull();
	});
	it('logs out other devices, not this one', () => {
		const here = createSession(userId);
		const there = createSession(userId);
		expect(deleteOtherSessions(userId, here.token)).toBeGreaterThanOrEqual(1);
		expect(validateSession(here.token)).not.toBeNull();
		expect(validateSession(there.token)).toBeNull();
	});
	it('expired sessions are cleaned up', () => {
		createSession(userId);
		vi.useFakeTimers({ now: Date.now() + 31 * DAY });
		expect(deleteExpiredSessions()).toBeGreaterThanOrEqual(1);
	});
});

describe('login protection', () => {
	it('blocks an address after 5 wrong passwords, for a minute', () => {
		vi.useFakeTimers();
		const ip = '203.0.113.5';
		for (let i = 0; i < 4; i++) recordLoginFailure(ip);
		expect(loginLockedFor(ip)).toBe(0);
		recordLoginFailure(ip);
		expect(loginLockedFor(ip)).toBe(60);
		expect(loginLockedFor('203.0.113.6')).toBe(0);
		vi.advanceTimersByTime(61_000);
		expect(loginLockedFor(ip)).toBe(0);
	});
	it('locks longer each time: 1, 5, then 15 minutes', () => {
		vi.useFakeTimers();
		const ip = '203.0.113.8';
		const failFiveTimes = () => {
			for (let i = 0; i < 5; i++) recordLoginFailure(ip);
			const seconds = loginLockedFor(ip);
			vi.advanceTimersByTime(seconds * 1000 + 1000);
			return seconds;
		};
		expect([failFiveTimes(), failFiveTimes(), failFiveTimes(), failFiveTimes()]).toEqual([
			60, 300, 900, 900
		]);
	});
	it('forgets an address after a day without wrong passwords', () => {
		vi.useFakeTimers();
		const ip = '203.0.113.9';
		for (let i = 0; i < 5; i++) recordLoginFailure(ip);
		vi.advanceTimersByTime(25 * 60 * 60 * 1000);
		pruneLoginFailures();
		for (let i = 0; i < 5; i++) recordLoginFailure(ip);
		expect(loginLockedFor(ip)).toBe(60); // starts again with one minute
	});
	it('counts the addresses blocked right now', () => {
		vi.useFakeTimers();
		const before = blockedAddresses();
		for (let i = 0; i < 5; i++) recordLoginFailure('203.0.113.20');
		expect(blockedAddresses()).toBe(before + 1);
		vi.advanceTimersByTime(61_000);
		// (addresses blocked by other tests may still be counted)
		expect(blockedAddresses()).toBeLessThanOrEqual(before);
	});
	it('attempts sent at the same moment cannot slip past the lock', async () => {
		const ip = '203.0.113.30';
		// A slow password check: all attempts start before the first one is answered
		let release!: () => void;
		const slow = new Promise<void>((resolve) => (release = resolve));
		const wrong = () => slow.then(() => false);
		const attempts = Array.from({ length: 50 }, () => checkPasswordGuarded(ip, wrong));
		release();
		const results = (await Promise.all(attempts)).map((a) => a.result);
		expect(results.filter((r) => r === 'wrong')).toHaveLength(5);
		expect(results.filter((r) => r === 'locked')).toHaveLength(45);
		expect(loginLockedFor(ip)).toBe(60);
	});

	it('a right password gets in, but does not reset the count', async () => {
		// Otherwise somebody with an account of their own could log in after every 4 guesses
		const ip = '203.0.113.31';
		for (let i = 0; i < 4; i++) recordLoginFailure(ip);
		expect((await checkPasswordGuarded(ip, async () => true)).result).toBe('ok');
		expect((await checkPasswordGuarded(ip, async () => false)).result).toBe('wrong');
		expect(loginLockedFor(ip)).toBe(60);
	});

	it('IPv6: the whole /64 block is one address', () => {
		expect(lockKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:1:2::/64');
		expect(lockKey('2001:DB8:1:2::1')).toBe('2001:db8:1:2::/64');
		expect(lockKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
		expect(lockKey('::1')).toBe('0:0:0:0::/64');
		expect(lockKey('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
		expect(lockKey('64:ff9b::192.0.2.1')).toBe('64:ff9b:0:0::/64');
		expect(lockKey('203.0.113.5')).toBe('203.0.113.5');

		const a = '2001:db8:5:6::1';
		for (let i = 0; i < 5; i++) recordLoginFailure(`2001:db8:5:6::${i + 10}`);
		expect(loginLockedFor(a)).toBe(60);
		expect(loginLockedFor('2001:db8:5:7::1')).toBe(0);
	});
});
