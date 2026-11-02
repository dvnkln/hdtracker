import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { promisify } from 'node:util';
import { error, type Cookies, type RequestEvent } from '@sveltejs/kit';
import { and, count, eq, lt, ne } from 'drizzle-orm';
import { SECRET } from '$app/env/private';
import { getDb } from './db';
import { sessions, users } from './db/schema';
import {
	PROXY_KEY_HEADER,
	addressFrom,
	defaultGateway,
	forwardedAddress,
	isTrusted,
	keyMatches,
	normalizeAddress,
	parseProxies
} from './proxy';
import { getSetting } from './settings';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = 'hdtracker_session';
const DAY = 24 * 60 * 60 * 1000;
const SESSION_DAYS = 30;

export type Role = 'admin' | 'user';
export type SessionUser = {
	id: number;
	username: string;
	role: Role;
	// Has a temporary password: has to choose one of their own before anything else
	mustChangePassword: boolean;
	// The name others see (the username while none is set) and the profile picture
	displayName: string | null;
	avatarColor: number;
	// Version of the profile picture (null: none of their own)
	avatarVersion: number | null;
};

// ---- Secret ----

// Throws at startup if SECRET is missing or too short.
export function getSecret() {
	const secret = SECRET;
	if (!secret || secret.length < 32) {
		throw new Error('SECRET must be set in .env and be at least 32 characters long');
	}
	return secret;
}

// ---- Passwords ----

// Format: scrypt$<salt hex>$<hash hex>
// (reset-password.js in the project root writes the same format – keep both in sync.)
export async function hashPassword(password: string) {
	const salt = randomBytes(16);
	const hash = await scryptAsync(password, salt, 64);
	return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string) {
	const [, saltHex, hashHex] = stored.split('$');
	const expected = Buffer.from(hashHex, 'hex');
	const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
	return timingSafeEqual(actual, expected);
}

// Used when a username does not exist, so the response takes as long as a real check.
const dummyHash = hashPassword(randomBytes(16).toString('hex'));
export async function verifyDummy(password: string) {
	await verifyPassword(password, await dummyHash);
	return false;
}

// ---- Users ----

let userExists = false;

// True once the admin account was created (cached: the last admin cannot be removed).
export function hasAnyUser() {
	if (!userExists) {
		const [row] = getDb().select({ n: count() }).from(users).all();
		userExists = row.n > 0;
	}
	return userExists;
}

// ---- Sessions ----

function sessionId(token: string) {
	return createHmac('sha256', getSecret()).update(token).digest('hex');
}

export function createSession(userId: number) {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY);
	getDb()
		.insert(sessions)
		.values({ id: sessionId(token), userId, expiresAt })
		.run();
	return { token, expiresAt };
}

// Returns the user for a cookie token, or null. Extends sessions that are past half their lifetime.
export function validateSession(token: string) {
	const db = getDb();
	const id = sessionId(token);
	const row = db
		.select({
			id: users.id,
			username: users.username,
			role: users.role,
			disabled: users.disabled,
			mustChangePassword: users.mustChangePassword,
			displayName: users.displayName,
			avatarColor: users.avatarColor,
			avatarUpdatedAt: users.avatarUpdatedAt,
			expiresAt: sessions.expiresAt
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, id))
		.get();
	if (!row) return null;

	// Expired, or the account was locked meanwhile
	if (row.expiresAt.getTime() < Date.now() || row.disabled) {
		db.delete(sessions).where(eq(sessions.id, id)).run();
		return null;
	}

	let renewedUntil: Date | null = null;
	if (row.expiresAt.getTime() - Date.now() < (SESSION_DAYS / 2) * DAY) {
		renewedUntil = new Date(Date.now() + SESSION_DAYS * DAY);
		db.update(sessions).set({ expiresAt: renewedUntil }).where(eq(sessions.id, id)).run();
	}
	const user: SessionUser = {
		id: row.id,
		username: row.username,
		role: row.role,
		mustChangePassword: row.mustChangePassword,
		displayName: row.displayName,
		avatarColor: row.avatarColor,
		avatarVersion: row.avatarUpdatedAt?.getTime() ?? null
	};
	return { user, renewedUntil };
}

export function deleteSession(token: string) {
	getDb()
		.delete(sessions)
		.where(eq(sessions.id, sessionId(token)))
		.run();
}

// Logs out all other browsers of this user; the one with `currentToken` stays logged in.
// Returns how many were logged out.
export function deleteOtherSessions(userId: number, currentToken: string) {
	return getDb()
		.delete(sessions)
		.where(and(eq(sessions.userId, userId), ne(sessions.id, sessionId(currentToken))))
		.run().changes;
}

// Returns how many were deleted.
export function deleteExpiredSessions() {
	return getDb().delete(sessions).where(lt(sessions.expiresAt, new Date())).run().changes;
}

// `secure` only on https (see isHttps in origins.ts), so login also works on plain http in the LAN.
export function setSessionCookie(cookies: Cookies, secure: boolean, token: string, expires: Date) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure,
		expires
	});
}

export function clearSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

// ---- Brute-force protection (in memory, per address) ----

// What we know about where a request comes from: the other end of the connection, the
// address a proxy passed along (if any) and the address that counts (see proxy.ts).
export function connectionOf(event: RequestEvent) {
	let peer = (event.platform as { req?: { socket?: { remoteAddress?: string } } } | undefined)?.req
		?.socket?.remoteAddress;
	if (!peer) {
		// Dev server: no direct access to the connection
		try {
			peer = event.getClientAddress();
		} catch {
			peer = 'unknown';
		}
	}
	const header = event.request.headers.get('x-forwarded-for');
	const proxies = parseProxies(getSetting('trustedProxies')).entries;
	const byKey = keyMatches(event.request.headers.get(PROXY_KEY_HEADER), getSetting('proxyKey'));
	const via: 'key' | 'address' | null = byKey ? 'key' : isTrusted(peer, proxies) ? 'address' : null;
	return {
		peer: normalizeAddress(peer),
		// What the proxy in front of us says the visitor's address is (believed or not)
		forwarded: forwardedAddress(header),
		// How the proxy has proven itself, if it has
		via,
		// Docker forwards the connection itself: the real address of the other end is not visible
		hidden: normalizeAddress(peer) === defaultGateway(),
		address: addressFrom(peer, header, proxies, byKey)
	};
}

// The address wrong passwords are counted for. Always use this, never getClientAddress().
export function clientAddress(event: RequestEvent) {
	return connectionOf(event).address;
}

const MAX_FAILURES = 5;
// Every 5 wrong passwords lock the address: first for 1 minute, then 5, then 15 each time.
const LOCK_MINUTES = [1, 5, 15];
const FORGET_MS = DAY;
type Failures = { count: number; locks: number; lockedUntil: number; lastFailure: number };
const failures = new Map<string, Failures>();

// What is counted and locked: an IPv4 address, or for IPv6 the whole block of 2^64 addresses
// (/64) – a single connection usually gets such a block and could pick a new address for every
// attempt.
export function lockKey(address: string) {
	const ip = normalizeAddress(address);
	if (isIP(ip) !== 6) return ip;
	const plain = ip.split('%')[0].toLowerCase();
	const [head, tail] = plain.split('::');
	const parts = (text: string | undefined) =>
		(text ? text.split(':') : []).flatMap((part) => (part.includes('.') ? ['0', '0'] : [part]));
	const front = parts(head);
	const back = parts(tail);
	const full = [...front, ...Array(8 - front.length - back.length).fill('0'), ...back];
	return `${full
		.slice(0, 4)
		.map((part) => Number.parseInt(part, 16).toString(16))
		.join(':')}::/64`;
}

// Returns remaining lock time in seconds, or 0 if login attempts are allowed.
export function loginLockedFor(ip: string) {
	const entry = failures.get(lockKey(ip));
	if (!entry || entry.lockedUntil < Date.now()) return 0;
	return Math.ceil((entry.lockedUntil - Date.now()) / 1000);
}

// Checks of a password that are still running, per address: they count as soon as they start.
// Otherwise many attempts sent at the same moment would all pass the lock before the first
// wrong one is counted.
const running = new Map<string, number>();

// One check of a password (login, or the current password in the settings), with the lock
// around it. 'locked' with the seconds to wait; 'wrong' is counted as a failure. A right
// password does not reset the count: otherwise somebody with an account of their own could log
// in after every 4 guesses at another one, and the lock would never come (the count is
// forgotten a day after the last wrong password, see pruneLoginFailures).
export async function checkPasswordGuarded(
	ip: string,
	check: () => Promise<boolean>
): Promise<{ result: 'ok' | 'wrong' } | { result: 'locked'; seconds: number }> {
	const key = lockKey(ip);
	const locked = loginLockedFor(ip);
	if (locked > 0) return { result: 'locked', seconds: locked };
	const now = running.get(key) ?? 0;
	// As many running as would lock the address if they all fail: wait for them
	if (now + (failures.get(key)?.count ?? 0) >= MAX_FAILURES)
		return { result: 'locked', seconds: 1 };
	running.set(key, now + 1);
	let ok: boolean;
	try {
		ok = await check();
	} finally {
		const left = (running.get(key) ?? 1) - 1;
		if (left > 0) running.set(key, left);
		else running.delete(key);
	}
	if (!ok) recordLoginFailure(ip);
	return { result: ok ? 'ok' : 'wrong' };
}

export function recordLoginFailure(ip: string) {
	const key = lockKey(ip);
	const entry = failures.get(key) ?? { count: 0, locks: 0, lockedUntil: 0, lastFailure: 0 };
	entry.count++;
	entry.lastFailure = Date.now();
	// One line per wrong password in the container log (never the password or the user name
	// that was typed): makes attacks visible and can be read by tools like fail2ban.
	console.warn(`Login failed: wrong password from ${ip}`);
	if (entry.count >= MAX_FAILURES) {
		const minutes = LOCK_MINUTES[Math.min(entry.locks, LOCK_MINUTES.length - 1)];
		entry.count = 0;
		entry.locks++;
		entry.lockedUntil = Date.now() + minutes * 60 * 1000;
		console.warn(`Login blocked: ${key} for ${minutes} min after ${MAX_FAILURES} wrong passwords`);
	}
	failures.set(key, entry);
}

// How many addresses are blocked right now (shown in the server overview).
export function blockedAddresses() {
	return [...failures.values()].filter((entry) => entry.lockedUntil > Date.now()).length;
}

// Forgets addresses without a wrong password for a day (hourly task "cache").
export function pruneLoginFailures() {
	for (const [ip, entry] of failures) {
		if (entry.lastFailure < Date.now() - FORGET_MS && entry.lockedUntil < Date.now()) {
			failures.delete(ip);
		}
	}
}

// ---- Permissions ----

// Admins may change settings for the whole installation (server, maintenance) and manage
// its accounts.
export function isAdmin(user: SessionUser | null): boolean {
	return user?.role === 'admin';
}

// For form actions and endpoints of admin pages (layout guards do not cover those).
export function requireAdmin(user: SessionUser | null) {
	if (!isAdmin(user)) error(403, 'Forbidden');
}
