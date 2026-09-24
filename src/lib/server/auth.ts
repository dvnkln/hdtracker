import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Cookies } from '@sveltejs/kit';
import { count, eq, lt } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { getDb } from './db';
import { sessions, users } from './db/schema';

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

export function deleteExpiredSessions() {
	getDb().delete(sessions).where(lt(sessions.expiresAt, new Date())).run();
}

// `secure` only on https, so login also works on plain http in the LAN.
export function setSessionCookie(cookies: Cookies, url: URL, token: string, expires: Date) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		expires
	});
}

export function clearSessionCookie(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

// ---- Brute-force protection (in memory, per IP) ----

const MAX_FAILURES = 5;
const LOCK_MS = 60 * 1000;
const failures = new Map<string, { count: number; lockedUntil: number }>();

// Returns remaining lock time in seconds, or 0 if login attempts are allowed.
export function loginLockedFor(ip: string) {
	const entry = failures.get(ip);
	if (!entry || entry.lockedUntil < Date.now()) return 0;
	return Math.ceil((entry.lockedUntil - Date.now()) / 1000);
}

export function recordLoginFailure(ip: string) {
	const entry = failures.get(ip) ?? { count: 0, lockedUntil: 0 };
	entry.count++;
	if (entry.count >= MAX_FAILURES) {
		entry.count = 0;
		entry.lockedUntil = Date.now() + LOCK_MS;
	}
	failures.set(ip, entry);
}

export function clearLoginFailures(ip: string) {
	failures.delete(ip);
}
