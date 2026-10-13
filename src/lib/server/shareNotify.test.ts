import { createECDH, randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addItem } from '../../tests/helpers';
import { getDb } from './db';
import { libraryItems, pushSubscriptions, users } from './db/schema';
import { withLocale } from './i18n';
import { clearLibrary, removeItem } from './library';
import { addDevice } from './push';
import { setUserSettings } from './settings';
import { announce, shareMessage, wantsShareNotice } from './shareNotify';
import { accept, decline, invite, inviteMany, leaveShared, withdraw } from './sharing';

let ann: number, ben: number;
const account = (username: string, uiLanguage = 'en') => {
	const id = getDb().insert(users).values({ username, passwordHash: 'x' }).returning().get().id;
	setUserSettings(id, { uiLanguage });
	return id;
};
// A device of somebody: makes them reachable
function device(userId: number, name: string) {
	const ecdh = createECDH('prime256v1');
	ecdh.generateKeys();
	addDevice(
		userId,
		{
			endpoint: `https://fcm.googleapis.com/fcm/send/${name}`,
			keys: {
				p256dh: ecdh.getPublicKey().toString('base64url'),
				auth: randomBytes(16).toString('base64url')
			}
		},
		''
	);
}
// Whose devices got a message so far (messages are sent in the background)
const reached = () => vi.mocked(fetch).mock.calls.map(([url]) => String(url).split('/').at(-1));
const settled = () => new Promise((resolve) => setTimeout(resolve, 20));
const film = (title: string, id: string, userId = ann) =>
	addItem({ category: 'movies', externalId: id, title, userId });
const invited = (by: number, itemId: number, to: number) => {
	const result = invite(by, itemId, to);
	if (!result.ok) throw new Error(result.error);
	return result.id;
};

beforeEach(() => {
	const db = getDb();
	db.delete(pushSubscriptions).run();
	db.delete(libraryItems).run();
	db.delete(users).run();
	ann = account('ann');
	ben = account('ben');
	device(ann, 'anns-phone');
	device(ben, 'bens-phone');
	vi.mocked(fetch).mockImplementation(async () => new Response(null, { status: 201 }));
});

describe('who is told what', () => {
	it('an invitation goes to the invited, the answer to who asked – at once', async () => {
		const item = film('Film', '1');
		const id = invited(ann, item.id, ben);
		await settled();
		expect(reached()).toEqual(['bens-phone']);
		accept(ben, id);
		await settled();
		expect(reached()).toEqual(['bens-phone', 'anns-phone']);
		decline(ben, invited(ann, film('Other', '2').id, ben));
		await settled();
		expect(reached()).toEqual(['bens-phone', 'anns-phone', 'bens-phone', 'anns-phone']);
	});

	it('leaving – with a copy or by removing the title – tells who stays', async () => {
		const one = film('One', '1');
		const two = film('Two', '2');
		accept(ben, invited(ann, one.id, ben));
		accept(ben, invited(ann, two.id, ben));
		await settled();
		vi.mocked(fetch).mockClear();

		leaveShared(ben, one.id);
		removeItem(ben, 'movies', '2');
		await settled();
		expect(reached()).toEqual(['anns-phone', 'anns-phone']);
		// Nobody is told about a title tracked alone, or about an invitation taken back
		vi.mocked(fetch).mockClear();
		removeItem(ann, 'movies', '1');
		withdraw(ann, invited(ann, two.id, ben));
		await settled();
		expect(reached()).toEqual(['bens-phone']); // only the invitation itself
	});

	it('several titles at once are one message', async () => {
		const ids = [film('A', '1'), film('B', '2'), film('C', '3')].map((item) => item.id);
		inviteMany(ann, ids, ben);
		await settled();
		expect(reached()).toEqual(['bens-phone']);
		for (const id of ids) accept(ben, invited(ann, id, ben));
		await settled();
		vi.mocked(fetch).mockClear();
		clearLibrary(ben, 'all');
		await settled();
		expect(reached()).toEqual(['anns-phone']);
	});
});

describe('switches', () => {
	it('each kind can be switched off; the answer switch covers accepting and declining', async () => {
		setUserSettings(ben, { notifyInvited: 'off' });
		setUserSettings(ann, { notifyAnswered: 'off', notifyLeft: 'off' });
		expect(wantsShareNotice(ben, 'invited')).toBe(false);
		expect(wantsShareNotice(ben, 'left')).toBe(true);

		const item = film('Film', '1');
		accept(ben, invited(ann, item.id, ben));
		decline(ben, invited(ann, film('Other', '2').id, ben));
		leaveShared(ben, item.id);
		await settled();
		expect(reached()).toEqual([]);
	});

	it('nothing is sent to somebody without a target, and a failing target breaks nothing', async () => {
		getDb().delete(pushSubscriptions).run();
		const item = film('Film', '1');
		expect(accept(ben, invited(ann, item.id, ben)).ok).toBe(true);
		await settled();
		expect(reached()).toEqual([]);

		device(ann, 'anns-phone');
		vi.mocked(fetch).mockRejectedValue(new Error('offline'));
		expect(leaveShared(ben, item.id).ok).toBe(true);
		await expect(
			announce([{ kind: 'left', actorId: ben, to: ann, itemId: item.id }])
		).resolves.toBeUndefined();
	});
});

describe('the message', () => {
	const item = (title: string, id: number) =>
		({
			id,
			category: 'movies',
			externalId: String(id),
			title,
			originalTitle: null,
			posterUrl: null
		}) as typeof libraryItems.$inferSelect;
	const mia = { id: 7, name: 'Mia' };

	it('names the title and who did what; an invitation opens the inbox', () => {
		expect(shareMessage('invited', mia, [item('Dune', 1)])).toMatchObject({
			title: 'Dune',
			body: 'Mia invites you to track this together',
			url: '/inbox',
			count: 1
		});
		expect(shareMessage('accepted', mia, [item('Dune', 1)])).toMatchObject({
			body: 'Mia accepted your invitation',
			url: '/movies/1'
		});
		expect(shareMessage('left', mia, [item('Dune', 1)]).body).toBe(
			'Mia no longer tracks this with you'
		);
	});

	it('for several titles counts them and names the first ones', () => {
		const many = ['A', 'B', 'C', 'D', 'E'].map((title, n) => item(title, n + 1));
		expect(shareMessage('invited', mia, many)).toMatchObject({
			title: 'Mia invites you to 5 titles',
			body: 'A\nB\nC\n… and 2 more',
			url: '/inbox',
			count: 5
		});
	});

	it('shows the photo of whoever did it, or two people in the colours of the logo', () => {
		expect(shareMessage('invited', mia, [item('Dune', 1)]).icon).toBe('/icons/share.png');
		const withPhoto = shareMessage('invited', { ...mia, picture: 1234 }, [item('Dune', 1)]);
		expect(withPhoto.icon).toMatch(/^\/avatar\/7\?v=1234&e=\d+&s=/);
		const many = ['A', 'B'].map((title, n) => item(title, n + 1));
		expect(shareMessage('left', { ...mia, picture: 1234 }, many).icon).toMatch(/^\/avatar\/7\?/);
	});

	it('two invitations to several titles are two messages, not one that replaces the other', () => {
		const films = ['A', 'B'].map((title, n) => item(title, n + 1));
		const shows = ['C', 'D'].map((title, n) => item(title, n + 11));
		const first = shareMessage('invited', mia, films).tag;
		expect(shareMessage('invited', mia, shows).tag).not.toBe(first);
		// The same titles again (in any order) are the same message
		expect(shareMessage('invited', mia, [...films].reverse()).tag).toBe(first);
	});

	it('is written in the language of who gets it', () => {
		const german = withLocale('de', () => shareMessage('declined', mia, [item('Dune', 1)]));
		expect(german.body).toBe('Mia hat deine Einladung abgelehnt');
	});
});
