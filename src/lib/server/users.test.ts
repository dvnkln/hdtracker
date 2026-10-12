import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { addItem } from '../../tests/helpers';
import { createSession, isAdmin, validateSession, verifyPassword } from './auth';
import {
	getChannel,
	listChannels,
	mayUseCustomTargets,
	saveChannel,
	sendToChannel
} from './channels';
import { getDb } from './db';
import { libraryItems, sessions, trackingMembers, userSettings, users } from './db/schema';
import { localeOf } from './i18n';
import { allItems } from './library';
import { setSettings, setUserSettings } from './settings';
import {
	MAX_AVATAR_BYTES,
	avatarOf,
	createUser,
	deleteUser,
	listUsers,
	nameInUse,
	removeAvatar,
	rerollColor,
	resetPassword,
	setAvatar,
	setDisplayName,
	setDisabled,
	setOwnPassword,
	setRole,
	temporaryPassword
} from './users';

let admin: number;
const row = (id: number) => getDb().select().from(users).where(eq(users.id, id)).get()!;
const add = async (username: string, role: 'admin' | 'user' = 'user') => {
	const made = await createUser(username, role, admin);
	if (!made.ok) throw new Error(made.error);
	return made;
};

beforeEach(() => {
	const db = getDb();
	db.delete(libraryItems).run();
	db.delete(users).run();
	admin = db
		.insert(users)
		.values({ username: 'boss', passwordHash: 'x', role: 'admin' })
		.returning()
		.get().id;
	setSettings({ customTargets: 'admins' });
});

describe('a new account', () => {
	it('gets a temporary password that has to be replaced, and the language of its creator', async () => {
		setUserSettings(admin, { uiLanguage: 'de' });
		const made = await add('anna');
		const anna = row(made.id);
		expect(anna.role).toBe('user');
		expect(anna.mustChangePassword).toBe(true);
		expect(anna.disabled).toBe(false);
		expect(await verifyPassword(made.password, anna.passwordHash)).toBe(true);
		expect(localeOf(made.id)).toBe('de');
		expect(allItems(made.id)).toEqual([]);
	});

	it('needs a proper name that nobody has yet (whatever the case)', async () => {
		expect(await createUser('a', 'user', admin)).toEqual({ ok: false, error: 'username' });
		expect(await createUser('with space', 'user', admin)).toEqual({ ok: false, error: 'username' });
		await add('Anna');
		expect(await createUser('anna', 'user', admin)).toEqual({ ok: false, error: 'taken' });
		expect(await createUser('BOSS', 'user', admin)).toEqual({ ok: false, error: 'taken' });
	});

	it('temporary passwords are long, readable and never the same', () => {
		const some = Array.from({ length: 50 }, () => temporaryPassword());
		expect(new Set(some).size).toBe(50);
		for (const password of some) expect(password).toMatch(/^[A-HJ-NP-Za-km-z2-9]{16}$/);
	});

	it('choosing a password of one’s own ends the temporary one', async () => {
		const made = await add('anna');
		await setOwnPassword(made.id, 'my-own-password');
		const anna = row(made.id);
		expect(anna.mustChangePassword).toBe(false);
		expect(await verifyPassword('my-own-password', anna.passwordHash)).toBe(true);
		expect(await verifyPassword(made.password, anna.passwordHash)).toBe(false);
	});
});

describe('roles', () => {
	it('only admins count as admins; the role changes at once', async () => {
		const { id } = await add('anna');
		const { token } = createSession(id);
		expect(isAdmin(validateSession(token)!.user)).toBe(false);
		expect(isAdmin(null)).toBe(false);
		expect(setRole(id, 'admin')).toEqual({ ok: true });
		expect(isAdmin(validateSession(token)!.user)).toBe(true);
	});

	it('the last admin who can log in stays an admin', async () => {
		expect(setRole(admin, 'user')).toEqual({ ok: false, error: 'lastAdmin' });
		const second = await add('second', 'admin');
		// A locked admin does not count: somebody has to be able to get in
		setDisabled(second.id, true, admin);
		expect(setRole(admin, 'user')).toEqual({ ok: false, error: 'lastAdmin' });
		setDisabled(second.id, false, admin);
		expect(setRole(admin, 'user')).toEqual({ ok: true });
		expect(setRole(second.id, 'user')).toEqual({ ok: false, error: 'lastAdmin' });
	});
});

describe('locking', () => {
	it('logs the account out and keeps it out, with everything else untouched', async () => {
		const { id } = await add('anna');
		addItem({ userId: id });
		const { token } = createSession(id);
		expect(validateSession(token)).not.toBeNull();

		expect(setDisabled(id, true, admin)).toEqual({ ok: true });
		expect(validateSession(token)).toBeNull();
		// Also a login that was still open somewhere is refused
		const late = createSession(id);
		expect(validateSession(late.token)).toBeNull();
		expect(allItems(id)).toHaveLength(1);

		setDisabled(id, false, admin);
		expect(validateSession(createSession(id).token)).not.toBeNull();
	});

	it('nobody locks themselves or the last admin out', async () => {
		expect(setDisabled(admin, true, admin)).toEqual({ ok: false, error: 'self' });
		const second = await add('second', 'admin');
		expect(setDisabled(admin, true, second.id)).toEqual({ ok: true });
		expect(setDisabled(second.id, true, admin)).toEqual({ ok: false, error: 'lastAdmin' });
	});
});

describe('resetting a password', () => {
	it('gives a new temporary one and logs the account out everywhere', async () => {
		const made = await add('anna');
		await setOwnPassword(made.id, 'my-own-password');
		const { token } = createSession(made.id);
		const reset = await resetPassword(made.id);
		if (!reset.ok) throw new Error('reset failed');
		const anna = row(made.id);
		expect(anna.mustChangePassword).toBe(true);
		expect(await verifyPassword(reset.password, anna.passwordHash)).toBe(true);
		expect(await verifyPassword('my-own-password', anna.passwordHash)).toBe(false);
		expect(validateSession(token)).toBeNull();
		expect(await resetPassword(9999)).toEqual({ ok: false, error: 'unknown' });
	});
});

describe('deleting an account', () => {
	it('removes everything that is its own and nothing of anybody else', async () => {
		const { id } = await add('anna');
		addItem({ externalId: '1', userId: id });
		addItem({ externalId: '2', userId: id });
		addItem({ externalId: '1', userId: admin });
		setUserSettings(id, { theme: 'dracula' });
		createSession(id);

		expect(deleteUser(id, admin)).toEqual({ ok: true });
		expect(listUsers().map((user) => user.username)).toEqual(['boss']);
		expect(getDb().select().from(sessions).where(eq(sessions.userId, id)).all()).toEqual([]);
		expect(getDb().select().from(userSettings).all()).toEqual([]);
		expect(getDb().select().from(trackingMembers).all()).toHaveLength(1);
		// The title only they tracked is gone, the one the admin tracks too stays
		expect(
			getDb()
				.select()
				.from(libraryItems)
				.all()
				.map((i) => i.externalId)
		).toEqual(['1']);
	});

	it('not oneself, not the last admin, not somebody unknown', async () => {
		expect(deleteUser(admin, admin)).toEqual({ ok: false, error: 'self' });
		const second = await add('second');
		expect(deleteUser(admin, second.id)).toEqual({ ok: false, error: 'lastAdmin' });
		expect(deleteUser(9999, admin)).toEqual({ ok: false, error: 'unknown' });
	});
});

describe('what an admin sees of the others', () => {
	it('the accounts with the number of titles – not the titles', async () => {
		const { id } = await add('anna');
		addItem({ externalId: '1', title: 'Private', userId: id });
		addItem({ externalId: '2', title: 'Also private', userId: id });
		const list = listUsers();
		expect(list.map((user) => [user.username, user.role, user.titles])).toEqual([
			['boss', 'admin', 0],
			['anna', 'user', 2]
		]);
		expect(JSON.stringify(list)).not.toContain('Private');
		expect(JSON.stringify(list)).not.toContain('passwordHash');
	});
});

describe('what others see of a user', () => {
	it('the display name, or the username while there is none', async () => {
		const { id } = await add('anna');
		const person = () => listUsers().find((user) => user.id === id)!.person;
		expect(person().name).toBe('anna');
		expect(setDisplayName(id, '  Anna   Banana ')).toEqual({ ok: true });
		expect(person().name).toBe('Anna Banana');
		expect(row(id).username).toBe('anna'); // logging in is untouched
		// Empty: back to the username
		expect(setDisplayName(id, '   ')).toEqual({ ok: true });
		expect(person().name).toBe('anna');
		expect(row(id).displayName).toBeNull();
	});

	it('nobody is shown under a name somebody else uses – to be seen or to log in', async () => {
		const anna = await add('anna');
		const ben = await add('ben');
		setDisplayName(anna.id, 'Captain');
		expect(setDisplayName(ben.id, 'captain')).toEqual({ ok: false, error: 'nameTaken' });
		expect(setDisplayName(ben.id, 'ANNA')).toEqual({ ok: false, error: 'nameTaken' });
		expect(setDisplayName(ben.id, 'Boss')).toEqual({ ok: false, error: 'nameTaken' });
		// One's own names are fine, in any case
		expect(setDisplayName(anna.id, 'Anna')).toEqual({ ok: true });
		expect(setDisplayName(anna.id, 'CAPTAIN')).toEqual({ ok: true });
		// ... and a new account cannot take a name somebody is shown under
		expect(await createUser('captain', 'user', admin)).toEqual({ ok: false, error: 'taken' });
		expect(nameInUse('Captain', anna.id)).toBe(false);
		expect(nameInUse('Captain', ben.id)).toBe(true);
	});

	it('a display name is short and has nothing invisible in it', async () => {
		const { id } = await add('anna');
		expect(setDisplayName(id, 'x'.repeat(31))).toEqual({ ok: false, error: 'displayName' });
		expect(setDisplayName(id, 'An\u200bna')).toEqual({ ok: false, error: 'displayName' });
		expect(setDisplayName(id, 'Zoë 🎬')).toEqual({ ok: true });
		expect(setDisplayName(9999, 'x')).toEqual({ ok: false, error: 'unknown' });
	});

	it('every account gets a colour; another one can be rolled', async () => {
		const { id } = await add('anna');
		const before = row(id).avatarColor;
		expect(before).toBeGreaterThanOrEqual(0);
		expect(before).toBeLessThan(360);
		const after = rerollColor(id);
		expect(after).not.toBe(before);
		expect(row(id).avatarColor).toBe(after);
		expect(row(admin).avatarColor).toBe(210); // nobody else's changes
	});
});

describe('profile pictures', () => {
	const photo = (width: number, height: number) =>
		sharp({ create: { width, height, channels: 3, background: '#3366cc' } })
			.withExif({ IFD0: { Copyright: 'secret place' } })
			.jpeg()
			.toBuffer();

	it('are stored anew as a small square JPEG, without what the camera wrote into the file', async () => {
		const { id } = await add('anna');
		expect(listUsers().find((user) => user.id === id)!.person.picture).toBeNull();
		expect(await setAvatar(id, await photo(1200, 800))).toEqual({ ok: true });

		const stored = avatarOf(id)!;
		const meta = await sharp(stored).metadata();
		expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 256, 256]);
		expect(meta.exif).toBeUndefined();
		expect(stored.includes('secret place')).toBe(false);
		// The picture's version changes with it, so browsers load the new one
		expect(listUsers().find((user) => user.id === id)!.person.picture).toBeTypeOf('number');
		expect(avatarOf(admin)).toBeNull();
	});

	it('refuse what is not a picture, what is empty and what is too large', async () => {
		const { id } = await add('anna');
		const text = new TextEncoder().encode('<script>alert(1)</script>');
		expect(await setAvatar(id, text)).toEqual({ ok: false, error: 'picture' });
		expect(await setAvatar(id, new Uint8Array())).toEqual({ ok: false, error: 'picture' });
		expect(await setAvatar(id, new Uint8Array(MAX_AVATAR_BYTES + 1))).toEqual({
			ok: false,
			error: 'picture'
		});
		expect(await setAvatar(9999, await photo(10, 10))).toEqual({ ok: false, error: 'unknown' });
		expect(avatarOf(id)).toBeNull();
	});

	it('can be removed again: back to the letter on the colour', async () => {
		const { id } = await add('anna');
		await setAvatar(id, await photo(300, 300));
		removeAvatar(id);
		expect(avatarOf(id)).toBeNull();
		expect(listUsers().find((user) => user.id === id)!.person.picture).toBeNull();
	});
});

describe('targets with an address of one’s own (webhook, ntfy)', () => {
	const webhook = (userId: number) =>
		saveChannel(userId, {
			id: null,
			kind: 'webhook',
			name: 'Hook',
			fields: { url: 'https://hook.example/in', body: '{{title}}' }
		});

	it('are for admins, unless an admin allowed them for everybody', async () => {
		const { id } = await add('anna');
		expect(mayUseCustomTargets(admin)).toBe(true);
		expect(mayUseCustomTargets(id)).toBe(false);
		expect(await webhook(id)).toEqual({ ok: false, error: 'notAllowed' });
		expect(await webhook(admin)).toMatchObject({ ok: true });

		setSettings({ customTargets: 'all' });
		expect(await webhook(id)).toMatchObject({ ok: true });
	});

	it('one that was set up while it was allowed is kept but no longer used', async () => {
		const { id } = await add('anna');
		setSettings({ customTargets: 'all' });
		const made = await webhook(id);
		setSettings({ customTargets: 'admins' });
		const channel = getChannel(id, made.ok ? made.id : 0)!;
		const sent = await sendToChannel(channel, {
			title: 'T',
			body: 'B',
			link: null,
			linkTitle: '',
			image: null,
			picture: async () => null,
			count: 1,
			test: false,
			icon: null
		});
		// (No request was made: the test would fail on any)
		expect(sent).toEqual({ ok: false, error: 'notAllowed' });
		expect(listChannels(id)[0].lastError).toBe('notAllowed');
	});
});
