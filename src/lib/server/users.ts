import { randomBytes, randomInt } from 'node:crypto';
import { and, count, eq, ne } from 'drizzle-orm';
import type { Person } from '$lib/avatar';
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
export type UserError =
	'username' | 'taken' | 'unknown' | 'lastAdmin' | 'self' | 'displayName' | 'nameTaken' | 'picture';
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
			createdAt: users.createdAt,
			displayName: users.displayName,
			avatarColor: users.avatarColor,
			avatarUpdatedAt: users.avatarUpdatedAt
		})
		.from(users)
		.orderBy(users.id)
		.all()
		.map(({ displayName, avatarColor, avatarUpdatedAt, ...user }) => ({
			...user,
			person: toPerson({
				id: user.id,
				username: user.username,
				displayName,
				avatarColor,
				avatarUpdatedAt
			}),
			titles: titles.get(user.id) ?? 0
		}));
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
	if (nameInUse(name)) return { ok: false, error: 'taken' };
	const created = db
		.insert(users)
		.values({
			username: name,
			passwordHash,
			role,
			mustChangePassword: true,
			avatarColor: randomHue()
		})
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

// ---- Profile: what others see of a user ----

type Shown = {
	id: number;
	username: string;
	displayName: string | null;
	avatarColor: number;
	avatarUpdatedAt: Date | null;
};

// The one place that decides which name others see: the display name, or the username while
// none is set.
export const shownName = (user: Pick<Shown, 'username' | 'displayName'>) =>
	user.displayName?.trim() || user.username;

export function toPerson(user: Shown): Person {
	return {
		id: user.id,
		name: shownName(user),
		color: user.avatarColor,
		picture: user.avatarUpdatedAt ? user.avatarUpdatedAt.getTime() : null
	};
}

export const randomHue = () => randomInt(360);

// Whether somebody else already goes by this name – as the name they log in with or as the
// name they are shown under, whatever the case. ("Anna" and "anna" would be told apart at
// login, but not by people; and nobody should be able to pose as somebody else.)
export function nameInUse(name: string, exceptId?: number) {
	const wanted = name.trim().toLowerCase();
	return getDb()
		.select({ id: users.id, username: users.username, displayName: users.displayName })
		.from(users)
		.all()
		.some(
			(other) =>
				other.id !== exceptId &&
				(other.username.toLowerCase() === wanted || shownName(other).toLowerCase() === wanted)
		);
}

export const MAX_DISPLAY_NAME = 30;

// Sets the name others see. Empty: back to the username. No two users may be shown under the
// same name (whatever the case) – otherwise nobody could tell who invites them.
export function setDisplayName(id: number, name: string): { ok: true } | Failed {
	// Spaces are tidied up; anything invisible that could fake another name is refused
	const wanted = name.trim().replace(/\s+/g, ' ');
	if (wanted.length > MAX_DISPLAY_NAME || /[\p{C}]/u.test(wanted)) {
		return { ok: false, error: 'displayName' };
	}
	const db = getDb();
	const me = find(id);
	if (!me) return { ok: false, error: 'unknown' };
	if (nameInUse(wanted || me.username, id)) return { ok: false, error: 'nameTaken' };
	db.update(users)
		.set({ displayName: wanted || null })
		.where(eq(users.id, id))
		.run();
	return { ok: true };
}

// A picture as it comes from the browser may be at most this large (the page shrinks photos
// before sending them).
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_SIZE = 256;

// Stores a profile picture: whatever was uploaded is read as an image, turned upright, cut to
// a square and saved anew as a small JPEG – nothing of the original file is kept (no location,
// no camera data), and something that is not an image is refused.
export async function setAvatar(id: number, file: Uint8Array): Promise<{ ok: true } | Failed> {
	if (!find(id)) return { ok: false, error: 'unknown' };
	if (file.length === 0 || file.length > MAX_AVATAR_BYTES) return { ok: false, error: 'picture' };
	let avatar: Buffer;
	try {
		const { default: sharp } = await import('sharp');
		avatar = await sharp(file, { limitInputPixels: 40_000_000 })
			.rotate() // as the camera held it
			.resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
			.flatten({ background: '#ffffff' })
			.jpeg({ quality: 85 })
			.toBuffer();
	} catch {
		return { ok: false, error: 'picture' };
	}
	getDb().update(users).set({ avatar, avatarUpdatedAt: new Date() }).where(eq(users.id, id)).run();
	return { ok: true };
}

export function removeAvatar(id: number) {
	getDb().update(users).set({ avatar: null, avatarUpdatedAt: null }).where(eq(users.id, id)).run();
}

// Another colour for the placeholder.
export function rerollColor(id: number) {
	const before = find(id)?.avatarColor ?? 0;
	// Clearly different from the one before
	const color = (before + 40 + randomInt(280)) % 360;
	getDb().update(users).set({ avatarColor: color }).where(eq(users.id, id)).run();
	return color;
}

// The picture itself, for the route that serves it.
export function avatarOf(id: number) {
	return (
		getDb().select({ avatar: users.avatar }).from(users).where(eq(users.id, id)).get()?.avatar ??
		null
	);
}
