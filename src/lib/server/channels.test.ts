import { createECDH, randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	listChannels,
	publicChannel,
	removeChannel,
	saveChannel,
	setChannelEnabled
} from './channels';
import { checkPushover, cleanDevices } from './channels/pushover';
import { getDb } from './db';
import { notificationChannels, pushSubscriptions, users } from './db/schema';
import { addDevice, listDevices } from './push';
import { deliver, hasEnabledTarget, listTargets, type Notice } from './targets';

const TOKEN = 'a'.repeat(30);
const USER = 'u'.repeat(30);

// What "Pushover" answers in these tests, and what it was asked.
type Call = { url: string; fields: Record<string, string>; attachment: Blob | null };
let calls: Call[] = [];
function pushover(
	answer: (call: Call) => { status: number; body: unknown } = () => ({
		status: 200,
		body: { status: 1, devices: ['phone', 'tablet'] }
	})
) {
	calls = [];
	vi.mocked(fetch).mockImplementation(async (url, init) => {
		const address = String(url);
		if (address.startsWith('https://image.tmdb.org/')) {
			return new Response(new Uint8Array(await POSTER), {
				headers: { 'Content-Type': 'image/jpeg' }
			});
		}
		if (!address.startsWith('https://api.pushover.net/')) {
			return new Response(null, { status: 201 }); // a push service of a browser
		}
		const form = init!.body as FormData;
		const fields: Record<string, string> = {};
		for (const [key, value] of form) if (typeof value === 'string') fields[key] = value;
		const file = form.get('attachment');
		const call = { url: address, fields, attachment: file instanceof Blob ? file : null };
		calls.push(call);
		const { status, body } = answer(call);
		return new Response(JSON.stringify(body), { status });
	});
}
// A poster as TMDB would serve it
const POSTER = sharp({ create: { width: 60, height: 90, channels: 3, background: '#c33' } })
	.jpeg()
	.toBuffer();
const refuse = { status: 400, body: { status: 0, errors: ['application token is invalid'] } };

let me: number;
let other: number;
const user = (username: string) =>
	getDb().insert(users).values({ username, passwordHash: 'x' }).returning().get().id;
const input = (
	fields: Record<string, string> = {},
	id: number | null = null,
	name = 'Pushover'
) => ({
	id,
	kind: 'pushover',
	name,
	fields: { token: TOKEN, user: USER, devices: '', picture: 'on', ...fields }
});
const notice = (extra: Partial<Notice> = {}): Notice => ({
	title: 'Movie',
	body: 'In cinemas',
	url: '/movies/1',
	source: null,
	count: 1,
	...extra
});
function device(userId: number, name: string) {
	const ecdh = createECDH('prime256v1');
	ecdh.generateKeys();
	const keys = {
		p256dh: ecdh.getPublicKey().toString('base64url'),
		auth: randomBytes(16).toString('base64url')
	};
	addDevice(userId, { endpoint: `https://fcm.googleapis.com/fcm/send/${name}`, keys }, '');
}

beforeEach(() => {
	const db = getDb();
	db.delete(notificationChannels).run();
	db.delete(pushSubscriptions).run();
	db.delete(users).run();
	me = user('me');
	other = user('other');
	pushover();
});

describe('Pushover: checking the keys', () => {
	it('asks Pushover and takes over the device names it reports', async () => {
		expect(await checkPushover(TOKEN, USER)).toEqual({ ok: true, devices: ['phone', 'tablet'] });
		expect(calls[0].url).toBe('https://api.pushover.net/1/users/validate.json');
		expect(calls[0].fields).toEqual({ token: TOKEN, user: USER });
	});
	it('works without a list of devices in the answer', async () => {
		pushover(() => ({ status: 200, body: { status: 1 } }));
		expect(await checkPushover(TOKEN, USER)).toEqual({ ok: true, devices: [] });
	});
	it('passes on why Pushover refuses, and tells apart "not reachable"', async () => {
		pushover(() => refuse);
		expect(await checkPushover(TOKEN, USER)).toEqual({
			ok: false,
			error: 'application token is invalid'
		});
		vi.mocked(fetch).mockImplementation(async () => {
			throw new Error('offline');
		});
		expect(await checkPushover(TOKEN, USER)).toEqual({ ok: false, error: 'unreachable' });
	});
});

describe('the device filter', () => {
	it('keeps names as Pushover takes them and drops what cannot be a name', () => {
		expect(cleanDevices('')).toBe('');
		expect(cleanDevices(' phone , tab-let_2 ')).toBe('phone,tab-let_2');
		expect(cleanDevices('phone,, has space,ok')).toBe('phone,ok');
	});
});

describe('saving a target', () => {
	it('checks the keys first and stores nothing that Pushover refuses', async () => {
		pushover(() => refuse);
		expect(await saveChannel(me, input())).toEqual({
			ok: false,
			error: 'refused',
			text: 'application token is invalid'
		});
		expect(listChannels(me)).toEqual([]);
		// Keys that cannot be right are not even sent
		expect(await saveChannel(me, input({ token: 'short' }))).toEqual({ ok: false, error: 'keys' });
		expect(calls).toHaveLength(1);
	});

	it('never hands the keys to the page, and keeps them when other fields change', async () => {
		const saved = await saveChannel(me, input({ devices: 'phone' }));
		expect(saved.ok).toBe(true);
		const [row] = listChannels(me);
		expect(JSON.stringify(publicChannel(row))).not.toContain(TOKEN);
		expect(JSON.stringify(publicChannel(row))).not.toContain(USER);
		expect(publicChannel(row).fields).toMatchObject({
			devices: 'phone',
			known: ['phone', 'tablet']
		});

		// Changed: name and filter; the key fields stay empty
		const changed = await saveChannel(
			me,
			input({ token: '', user: '', devices: 'tablet' }, row.id, 'Wohnzimmer')
		);
		expect(changed).toEqual({ ok: true, id: row.id });
		const [after] = listChannels(me);
		expect(after.name).toBe('Wohnzimmer');
		expect(after.config).toMatchObject({ token: TOKEN, user: USER, devices: 'tablet' });
	});

	it('belongs to its user: others can neither change, switch nor remove it', async () => {
		await saveChannel(me, input());
		const [row] = listChannels(me);
		expect(listChannels(other)).toEqual([]);
		expect(await saveChannel(other, input({}, row.id, 'Mine now'))).toEqual({
			ok: false,
			error: 'unknown'
		});
		expect(setChannelEnabled(other, row.id, false)).toBe(false);
		expect(removeChannel(other, row.id)).toBe(false);
		expect(listChannels(me)[0]).toMatchObject({ name: 'Pushover', enabled: true });
	});

	it('several of a kind are fine, up to ten', async () => {
		for (let i = 1; i <= 10; i++) {
			expect((await saveChannel(me, input({}, null, `Pushover ${i}`))).ok).toBe(true);
		}
		expect(await saveChannel(me, input({}, null, 'One more'))).toEqual({
			ok: false,
			error: 'tooMany'
		});
		// ... but an existing one can still be changed
		const [first] = listChannels(me);
		expect((await saveChannel(me, input({}, first.id, 'Renamed'))).ok).toBe(true);
	});
});

describe('delivering', () => {
	it('sends title, text and a link; the filter only if one is set, exactly as entered', async () => {
		await saveChannel(me, input({ devices: '' }, null, 'All'));
		await saveChannel(me, input({ devices: 'phone,tablet' }, null, 'Two'));
		pushover();
		const results = await deliver(me, notice());
		expect(results.map((r) => [r.name, r.ok])).toEqual([
			['All', true],
			['Two', true]
		]);
		const [all, two] = calls;
		expect(all.url).toBe('https://api.pushover.net/1/messages.json');
		expect(all.fields).toMatchObject({
			token: TOKEN,
			user: USER,
			title: 'Movie',
			message: 'In cinemas'
		});
		expect('device' in all.fields).toBe(false);
		expect(two.fields.device).toBe('phone,tablet');
	});

	it('attaches the large picture as a file – built once for all channels', async () => {
		await saveChannel(me, input({}, null, 'One'));
		await saveChannel(me, input({}, null, 'Two'));
		pushover();
		const poster = 'https://image.tmdb.org/t/p/w342/poster-of-the-test.jpg';
		await deliver(me, notice({ source: { layout: 'banner', addresses: [poster] } }));
		expect(calls.map((call) => call.attachment?.type)).toEqual(['image/jpeg', 'image/jpeg']);
		const { width, height } = await sharp(
			Buffer.from(await calls[0].attachment!.arrayBuffer())
		).metadata();
		expect([width, height]).toEqual([720, 360]);
		const asked = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
		expect(asked.filter((url) => url === poster)).toHaveLength(1);
		// Switched off for this target: no attachment, and the picture is not even built
		const [one] = listChannels(me);
		await saveChannel(me, input({ picture: '' }, one.id, 'One'));
		pushover();
		await deliver(me, notice({ source: { layout: 'banner', addresses: [poster] } }), {
			type: 'channel',
			id: one.id
		});
		expect(calls.at(-1)!.attachment).toBeNull();
		// Without a picture there is simply no attachment
		pushover();
		await deliver(me, notice());
		expect(calls[0].attachment).toBeNull();
	});

	it('shortens what is longer than Pushover allows', async () => {
		await saveChannel(me, input());
		pushover();
		await deliver(me, notice({ title: 'T'.repeat(400), body: 'B'.repeat(3000) }));
		expect(calls[0].fields.title).toHaveLength(250);
		expect(calls[0].fields.message).toHaveLength(1024);
		expect(calls[0].fields.message.endsWith('…')).toBe(true);
	});

	it('leaves out what is switched off – but keeps it, and a test still reaches it', async () => {
		await saveChannel(me, input());
		const [row] = listChannels(me);
		setChannelEnabled(me, row.id, false);
		pushover();
		expect(hasEnabledTarget(me)).toBe(false);
		expect(await deliver(me, notice())).toEqual([]);
		expect(calls).toHaveLength(0);
		expect(listChannels(me)[0].config).toMatchObject({ token: TOKEN });
		// A test goes to exactly this one target
		const tested = await deliver(me, notice({ test: true }), { type: 'channel', id: row.id });
		expect(tested.map((r) => r.ok)).toEqual([true]);
	});

	it('remembers why a target failed, and forgets it when it works again', async () => {
		await saveChannel(me, input());
		pushover(() => refuse);
		const [failed] = await deliver(me, notice());
		expect(failed).toMatchObject({ ok: false, error: 'application token is invalid' });
		expect(listTargets(me)[0]).toMatchObject({ lastError: 'application token is invalid' });
		pushover();
		await deliver(me, notice());
		expect(listTargets(me)[0]).toMatchObject({ lastError: null });
		expect(listTargets(me)[0].lastOkAt).not.toBeNull();
	});

	it('reaches devices and channels alike; one failing does not stop the others', async () => {
		device(me, 'phone');
		await saveChannel(me, input({}, null, 'Broken'));
		await saveChannel(me, input({}, null, 'Fine'));
		device(other, 'theirs');
		let n = 0;
		pushover((call) =>
			call.url.endsWith('messages.json') && n++ === 0
				? refuse
				: { status: 200, body: { status: 1 } }
		);
		const results = await deliver(me, notice());
		expect(results.map((r) => [r.name, r.ok])).toEqual([
			[listDevices(me)[0].label, true],
			['Broken', false],
			['Fine', true]
		]);
		// Nothing went to the other user's device
		const asked = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
		expect(asked.some((url) => url.endsWith('/theirs'))).toBe(false);
	});

	it('a test of one device goes to that device only', async () => {
		device(me, 'phone');
		device(me, 'laptop');
		await saveChannel(me, input());
		pushover();
		const [, laptop] = listDevices(me);
		const results = await deliver(me, notice({ test: true }), { type: 'device', id: laptop.id });
		expect(results).toHaveLength(1);
		const asked = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
		expect(asked.filter((url) => url.includes('fcm.googleapis.com'))).toEqual([
			'https://fcm.googleapis.com/fcm/send/laptop'
		]);
		expect(calls.filter((call) => call.url.endsWith('messages.json'))).toHaveLength(0);
	});
});
