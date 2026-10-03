import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { error, type Cookies, type RequestEvent } from '@sveltejs/kit';
import { and, count, eq, lt, ne } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
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

export type SessionUser = { id: number; username: string };

// ---- Secret ----

// Throws at startup if SECRET is missing or too short.
export function getSecret() {
	const secret = env.SECRET;
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

// True once the admin account was created (cached, users are never deleted).
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
		.select({ id: users.id, username: users.username, expiresAt: sessions.expiresAt })
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(eq(sessions.id, id))
		.get();
	if (!row) return null;

	if (row.expiresAt.getTime() < Date.now()) {
		db.delete(sessions).where(eq(sessions.id, id)).run();
		return null;
	}

	let renewedUntil: Date | null = null;
	if (row.expiresAt.getTime() - Date.now() < (SESSION_DAYS / 2) * DAY) {
		renewedUntil = new Date(Date.now() + SESSION_DAYS * DAY);
		db.update(sessions).set({ expiresAt: renewedUntil }).where(eq(sessions.id, id)).run();
	}
	const user: SessionUser = { id: row.id, username: row.username };
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

// Returns remaining lock time in seconds, or 0 if login attempts are allowed.
export function loginLockedFor(ip: string) {
	const entry = failures.get(ip);
	if (!entry || entry.lockedUntil < Date.now()) return 0;
	return Math.ceil((entry.lockedUntil - Date.now()) / 1000);
}

export function recordLoginFailure(ip: string) {
	const entry = failures.get(ip) ?? { count: 0, locks: 0, lockedUntil: 0, lastFailure: 0 };
	entry.count++;
	entry.lastFailure = Date.now();
	if (entry.count >= MAX_FAILURES) {
		const minutes = LOCK_MINUTES[Math.min(entry.locks, LOCK_MINUTES.length - 1)];
		entry.count = 0;
		entry.locks++;
		entry.lockedUntil = Date.now() + minutes * 60 * 1000;
	}
	failures.set(ip, entry);
}

export function clearLoginFailures(ip: string) {
	failures.delete(ip);
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

// Admins may change settings for the whole installation (server, maintenance). There is only
// one account for now, and it is the admin; with several users this becomes a real check.
export function isAdmin(user: SessionUser | null): boolean {
	return user !== null;
}

// For form actions and endpoints of admin pages (layout guards do not cover those).
export function requireAdmin(user: SessionUser | null) {
	if (!isAdmin(user)) error(403, 'Forbidden');
}
