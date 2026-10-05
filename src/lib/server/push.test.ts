import { createECDH, randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { getDb } from './db';
import { users } from './db/schema';
import {
	addDevice,
	deviceLabel,
	isPushService,
	listDevices,
	parseSubscription,
	pushPublicKey,
	removeDevice,
	renameDevice,
	setDeviceEnabled,
	sendPush
} from './push';

// A subscription as a browser would send it: real keys, an address at a push service.
function subscription(endpoint: string) {
	const ecdh = createECDH('prime256v1');
	ecdh.generateKeys();
	return {
		endpoint,
		keys: {
			p256dh: ecdh.getPublicKey().toString('base64url'),
			auth: randomBytes(16).toString('base64url')
		}
	};
}
let n = 0;
const user = () =>
	getDb()
		.insert(users)
		.values({ username: `user${n++}`, passwordHash: 'x' })
		.returning()
		.get().id;
const CHROME_ANDROID =
	'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

describe('isPushService', () => {
	it('accepts the push services of the browsers', () => {
		for (const endpoint of [
			'https://fcm.googleapis.com/fcm/send/abc',
			'https://updates.push.services.mozilla.com/wpush/v2/abc',
			'https://web.push.apple.com/abc',
			'https://wns2-par02p.notify.windows.com/w/?token=abc'
		]) {
			expect(isPushService(endpoint), endpoint).toBe(true);
		}
	});
	it('refuses everything else', () => {
		for (const endpoint of [
			'http://fcm.googleapis.com/fcm/send/abc', // not https
			'https://fcm.googleapis.com:8443/x', // other port
			'https://localhost/x',
			'https://192.168.1.1/x',
			'https://example.com/fcm.googleapis.com',
			'https://fcm.googleapis.com.example.com/x',
			'https://evilnotify.windows.com/x',
			'https://user:pass@fcm.googleapis.com/x',
			'not an address',
			''
		]) {
			expect(isPushService(endpoint), endpoint).toBe(false);
		}
	});
});

describe('parseSubscription', () => {
	const good = subscription('https://fcm.googleapis.com/fcm/send/abc');
	it('takes what a browser sends', () => {
		expect(parseSubscription(JSON.stringify({ ...good, expirationTime: null }))).toEqual(good);
	});
	it('refuses unknown services, wrong keys and nonsense', () => {
		const bad = [
			{ ...good, endpoint: 'https://example.com/push' },
			{ ...good, keys: { ...good.keys, p256dh: 'short' } },
			{ ...good, keys: { ...good.keys, auth: good.keys.p256dh } },
			{ endpoint: good.endpoint },
			null,
			'text'
		];
		for (const value of bad) expect(parseSubscription(JSON.stringify(value))).toBeNull();
		expect(parseSubscription('{')).toBeNull();
	});
});

describe('deviceLabel', () => {
	it('names browser and system', () => {
		expect(deviceLabel(CHROME_ANDROID)).toBe('Chrome · Android');
		expect(
			deviceLabel(
				'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
			)
		).toBe('Safari · iPhone');
		expect(
			deviceLabel(
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0'
			)
		).toBe('Firefox · Windows');
		expect(
			deviceLabel(
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0'
			)
		).toBe('Edge · Windows');
		expect(deviceLabel('')).toBe('Browser');
	});
});

describe('devices', () => {
	it('belong to their user: others neither see nor remove them', () => {
		const [anna, ben] = [user(), user()];
		addDevice(anna, subscription('https://fcm.googleapis.com/fcm/send/anna'), CHROME_ANDROID);
		const [device] = listDevices(anna);
		expect(device.label).toBe('Chrome · Android');
		expect(listDevices(ben)).toEqual([]);
		expect(removeDevice(ben, device.id)).toBe(false);
		expect(listDevices(anna)).toHaveLength(1);
		expect(removeDevice(anna, device.id)).toBe(true);
		expect(listDevices(anna)).toEqual([]);
	});

	it('a browser that replaced its subscription keeps its entry, name and switch', () => {
		const [anna, ben] = [user(), user()];
		const address = (name: string) => `https://fcm.googleapis.com/fcm/send/${name}`;
		addDevice(anna, subscription(address('old')), CHROME_ANDROID);
		const [before] = listDevices(anna);
		renameDevice(anna, before.id, 'Phone');
		setDeviceEnabled(anna, before.id, false);

		expect(addDevice(anna, subscription(address('new')), CHROME_ANDROID, address('old'))).toBe(
			true
		);
		expect(listDevices(anna)).toMatchObject([
			{ id: before.id, endpoint: address('new'), label: 'Phone', enabled: false }
		]);

		// Somebody else naming that address removes nothing: they simply get a device of their own
		addDevice(ben, subscription(address('ben')), CHROME_ANDROID, address('new'));
		expect(listDevices(anna)).toHaveLength(1);
		expect(listDevices(ben)).toMatchObject([{ endpoint: address('ben') }]);

		// Both addresses listed already (the page was not told at the time): the dead one goes
		addDevice(anna, subscription(address('newer')), CHROME_ANDROID);
		addDevice(anna, subscription(address('newer')), CHROME_ANDROID, address('new'));
		expect(listDevices(anna).map((d) => d.endpoint)).toEqual([address('newer')]);
	});

	it('a device that subscribes again is stored once, with its new keys', () => {
		const me = user();
		const endpoint = 'https://fcm.googleapis.com/fcm/send/again';
		addDevice(me, subscription(endpoint), CHROME_ANDROID);
		addDevice(me, subscription(endpoint), CHROME_ANDROID);
		expect(listDevices(me)).toHaveLength(1);
	});

	it('can be renamed by their owner, and keep the name when they subscribe again', () => {
		const [me, other] = [user(), user()];
		const endpoint = 'https://fcm.googleapis.com/fcm/send/named';
		addDevice(me, subscription(endpoint), CHROME_ANDROID);
		const { id } = listDevices(me)[0];
		expect(renameDevice(other, id, 'Not mine')).toBe(false);
		expect(renameDevice(me, id, '   ')).toBe(false);
		expect(renameDevice(me, id, 'x'.repeat(41))).toBe(false);
		expect(renameDevice(me, id, '  Handy  ')).toBe(true);
		expect(listDevices(me)[0].label).toBe('Handy');
		addDevice(me, subscription(endpoint), CHROME_ANDROID);
		expect(listDevices(me)[0].label).toBe('Handy');
	});

	it('are limited to 20 per user', () => {
		const me = user();
		const add = (i: number) =>
			addDevice(me, subscription(`https://fcm.googleapis.com/fcm/send/many${i}`), CHROME_ANDROID);
		for (let i = 0; i < 20; i++) expect(add(i)).toBe(true);
		expect(add(20)).toBe(false);
		// ... but a known one may still renew itself
		expect(add(3)).toBe(true);
	});
});

describe('sendPush', () => {
	const message = { title: 'hdtracker', body: 'Test', url: '/' };

	it('sends an encrypted, signed message to every device of the user only', async () => {
		const [me, other] = [user(), user()];
		addDevice(me, subscription('https://fcm.googleapis.com/fcm/send/one'), CHROME_ANDROID);
		addDevice(me, subscription('https://web.push.apple.com/two'), CHROME_ANDROID);
		addDevice(other, subscription('https://fcm.googleapis.com/fcm/send/other'), CHROME_ANDROID);
		vi.mocked(fetch).mockImplementation(async () => new Response(null, { status: 201 }));

		const results = await sendPush(me, message);
		expect(results.map((r) => r.ok)).toEqual([true, true]);
		const calls = vi.mocked(fetch).mock.calls;
		expect(calls.map(([url]) => String(url))).toEqual([
			'https://fcm.googleapis.com/fcm/send/one',
			'https://web.push.apple.com/two'
		]);
		const init = calls[0][1]!;
		const headers = init.headers as Record<string, string>;
		expect(init.method).toBe('POST');
		expect(headers['Content-Encoding']).toBe('aes128gcm');
		expect(headers.Authorization).toContain(`k=${pushPublicKey()}`);
		// The text itself is not readable in what is sent
		expect(Buffer.from(init.body as Uint8Array).toString('latin1')).not.toContain('hdtracker');
		expect(listDevices(me).every((d) => d.lastOkAt !== null)).toBe(true);
	});

	it('removes a device the push service no longer knows and reports failures', async () => {
		const me = user();
		addDevice(me, subscription('https://fcm.googleapis.com/fcm/send/gone'), CHROME_ANDROID);
		addDevice(me, subscription('https://fcm.googleapis.com/fcm/send/busy'), CHROME_ANDROID);
		addDevice(me, subscription('https://fcm.googleapis.com/fcm/send/fine'), CHROME_ANDROID);
		vi.mocked(fetch).mockImplementation(async (url) => {
			const address = String(url);
			if (address.endsWith('gone')) return new Response(null, { status: 410 });
			if (address.endsWith('busy')) return new Response('later', { status: 503 });
			return new Response(null, { status: 201 });
		});
		const results = await sendPush(me, message);
		expect(results.map((r) => r.ok)).toEqual([false, false, true]);
		// Gone is deleted, the one that was only busy stays
		expect(listDevices(me).map((d) => d.endpoint.split('/').pop())).toEqual(['busy', 'fine']);
	});

	it('survives a push service that cannot be reached', async () => {
		const me = user();
		addDevice(me, subscription('https://fcm.googleapis.com/fcm/send/offline'), CHROME_ANDROID);
		vi.mocked(fetch).mockImplementation(async () => {
			throw new Error('offline');
		});
		expect((await sendPush(me, message)).map((r) => r.ok)).toEqual([false]);
		expect(listDevices(me)).toHaveLength(1);
	});
});
