import { randomBytes } from 'node:crypto';
import { and, count, eq, ne } from 'drizzle-orm';
import { USERNAME_PATTERN } from '$lib/limits';
import { hashPassword, type Role } from './auth';
import { getDb } from './db';
import { sessions, trackingMembers, users } from './db/schema';
import { localeOf } from './i18n';
import { removeOrphans } from './library';
import { setUserSettings } from './settings';

// The accounts of the installation. An admin creates them – nobody can register themselves.
// A new account gets a temporary password that is shown once; its owner has to choose their
// own right after logging in (`mustChangePassword`). There is always at least one admin who
// can log in.

// What went wrong – a key of `users.errors` in the texts.
export type UserError = 'username' | 'taken' | 'unknown' | 'lastAdmin' | 'self';
type Failed = { ok: false; error: UserError };

// Readable and free of characters that look alike (no 0/O, 1/l/I).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
export function temporaryPassword(length = 16): string {
	const bytes = randomBytes(length * 2);
	let password = '';
	// Bytes that would favour the first letters of the alphabet are skipped
	const limit = 256 - (256 % ALPHABET.length);
	for (const byte of bytes) {
		if (byte < limit && password.length < length) password += ALPHABET[byte % ALPHABET.length];
	}
	return password.length === length ? password : temporaryPassword(length);
}

// The accounts as the admin sees them: no library, only how many titles somebody tracks.
export function listUsers() {
	const db = getDb();
	const titles = new Map(
		db
			.select({ userId: trackingMembers.userId, n: count() })
			.from(trackingMembers)
			.groupBy(trackingMembers.userId)
			.all()
			.map((row) => [row.userId, row.n])
	);
	return db
		.select({
			id: users.id,
			username: users.username,
			role: users.role,
			disabled: users.disabled,
			mustChangePassword: users.mustChangePassword,
			lastLoginAt: users.lastLoginAt,
			createdAt: users.createdAt
		})
		.from(users)
		.orderBy(users.id)
		.all()
		.map((user) => ({ ...user, titles: titles.get(user.id) ?? 0 }));
}

const find = (id: number) => getDb().select().from(users).where(eq(users.id, id)).get();

// Whether there would still be an admin who can log in without this account.
function anotherAdmin(id: number) {
	return !!getDb()
		.select({ id: users.id })
		.from(users)
		.where(and(eq(users.role, 'admin'), eq(users.disabled, false), ne(users.id, id)))
		.get();
}
const isLastAdmin = (user: NonNullable<ReturnType<typeof find>>) =>
	user.role === 'admin' && !user.disabled && !anotherAdmin(user.id);

// Creates an account with a temporary password. `by`: the admin who creates it – the new
// account starts in their interface language.
export async function createUser(
	username: string,
	role: Role,
	by: number
): Promise<{ ok: true; id: number; password: string } | Failed> {
	const name = username.trim();
	if (!USERNAME_PATTERN.test(name)) return { ok: false, error: 'username' };
	const password = temporaryPassword();
	const passwordHash = await hashPassword(password);
	const db = getDb();
	// "Anna" and "anna" would be told apart at login, but not by people
	const taken = db
		.select({ username: users.username })
		.from(users)
		.all()
		.some((user) => user.username.toLowerCase() === name.toLowerCase());
	if (taken) return { ok: false, error: 'taken' };
	const created = db
		.insert(users)
		.values({ username: name, passwordHash, role, mustChangePassword: true })
		.returning({ id: users.id })
		.get();
	setUserSettings(created.id, { uiLanguage: localeOf(by) });
	return { ok: true, id: created.id, password };
}

// Gives an account a new temporary password and logs it out everywhere.
export async function resetPassword(id: number): Promise<{ ok: true; password: string } | Failed> {
	if (!find(id)) return { ok: false, error: 'unknown' };
	const password = temporaryPassword();
	const passwordHash = await hashPassword(password);
	const db = getDb();
	db.transaction((tx) => {
		tx.update(users).set({ passwordHash, mustChangePassword: true }).where(eq(users.id, id)).run();
		tx.delete(sessions).where(eq(sessions.userId, id)).run();
	});
	return { ok: true, password };
}

// A password of the user's own, chosen by themselves: ends the temporary one.
export async function setOwnPassword(id: number, password: string) {
	const passwordHash = await hashPassword(password);
	getDb()
		.update(users)
		.set({ passwordHash, mustChangePassword: false })
		.where(eq(users.id, id))
		.run();
}

export function setRole(id: number, role: Role): { ok: true } | Failed {
	const user = find(id);
	if (!user) return { ok: false, error: 'unknown' };
	if (role !== 'admin' && isLastAdmin(user)) return { ok: false, error: 'lastAdmin' };
	getDb().update(users).set({ role }).where(eq(users.id, id)).run();
	return { ok: true };
}

// Locks or unlocks an account. Locked: logged out everywhere, logging in is refused;
// library, settings and what is tracked together with others stay as they are.
// `by`: nobody locks themselves out.
export function setDisabled(id: number, disabled: boolean, by: number): { ok: true } | Failed {
	const user = find(id);
	if (!user) return { ok: false, error: 'unknown' };
	if (disabled && id === by) return { ok: false, error: 'self' };
	if (disabled && isLastAdmin(user)) return { ok: false, error: 'lastAdmin' };
	const db = getDb();
	db.transaction((tx) => {
		tx.update(users).set({ disabled }).where(eq(users.id, id)).run();
		if (disabled) tx.delete(sessions).where(eq(sessions.userId, id)).run();
	});
	return { ok: true };
}

// Deletes an account with everything that is its own: library, watched episodes, settings,
// devices and notification targets. What it tracked together with others stays for them.
export function deleteUser(id: number, by: number): { ok: true } | Failed {
	const user = find(id);
	if (!user) return { ok: false, error: 'unknown' };
	if (id === by) return { ok: false, error: 'self' };
	if (isLastAdmin(user)) return { ok: false, error: 'lastAdmin' };
	const db = getDb();
	db.transaction((tx) => {
		tx.delete(users).where(eq(users.id, id)).run(); // the rest goes with it (see schema.ts)
		removeOrphans(tx);
	});
	return { ok: true };
}

export function recordLogin(id: number) {
	getDb().update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, id)).run();
}
