import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listChannels, publicChannel, saveChannel, type Outgoing } from '../channels';
import { getDb } from '../db';
import { notificationChannels, users } from '../db/schema';
import { deliver } from '../targets';
import { DEFAULT_BODY, isWebhookUrl, parseHeader, renderTemplate, sendWebhook } from './webhook';

const values = {
	title: 'Movie',
	message: 'In cinemas',
	url: 'https://tracker.example/movies/1',
	image: '',
	count: '1',
	test: 'false'
};
const outgoing = (extra: Partial<Outgoing> = {}): Outgoing => ({
	title: 'Movie',
	body: 'In cinemas',
	link: 'https://tracker.example/movies/1',
	linkTitle: 'Open in hdtracker',
	image: null,
	picture: async () => null,
	count: 1,
	test: false,
	icon: null,
	...extra
});
// What the webhook was sent
const sent = () => {
	const [url, init] = vi.mocked(fetch).mock.calls.at(-1)!;
	return { url: String(url), init: init!, headers: init!.headers as Record<string, string> };
};
const answer = (status = 200, body = '') =>
	vi.mocked(fetch).mockImplementation(async () => new Response(body, { status }));

describe('renderTemplate', () => {
	it('fills in the placeholders; unknown ones stay as they are', () => {
		const { body, json } = renderTemplate('{{title}}: {{ message }} ({{nope}})', values);
		expect(body).toBe('Movie: In cinemas ({{nope}})');
		expect(json).toBe(false);
	});

	it('escapes values in a JSON template, so quotes and line breaks cannot break it', () => {
		const { body, json } = renderTemplate(DEFAULT_BODY, {
			...values,
			title: 'The "Best" \\ Movie',
			message: 'Line one\nLine two'
		});
		expect(json).toBe(true);
		expect(JSON.parse(body)).toEqual({
			title: 'The "Best" \\ Movie',
			message: 'Line one\nLine two',
			url: 'https://tracker.example/movies/1'
		});
	});

	it('a value cannot smuggle in fields of its own', () => {
		const { body } = renderTemplate('{"title":"{{title}}"}', {
			...values,
			title: '","admin":"true'
		});
		expect(JSON.parse(body)).toEqual({ title: '","admin":"true' });
	});

	it('plain text stays plain, and broken JSON is sent as text', () => {
		expect(renderTemplate('{{title}} – "{{message}}"', values).body).toBe('Movie – "In cinemas"');
		expect(renderTemplate('{ "title": {{title}} ', values).json).toBe(false);
	});
});

describe('address and header', () => {
	it('takes http and https addresses only', () => {
		expect(isWebhookUrl('https://ntfy.example/topic')).toBe(true);
		expect(isWebhookUrl('http://192.168.1.20:8080/message?token=abc')).toBe(true);
		for (const bad of [
			'ftp://example.com',
			'file:///etc/passwd',
			'javascript:alert(1)',
			'ntfy',
			''
		]) {
			expect(isWebhookUrl(bad), bad).toBe(false);
		}
	});
	it('reads "Name: value" and refuses anything else, above all line breaks', () => {
		expect(parseHeader('Authorization: Bearer abc.def')).toEqual([
			'Authorization',
			'Bearer abc.def'
		]);
		expect(parseHeader('X-Gotify-Key:abc')).toEqual(['X-Gotify-Key', 'abc']);
		for (const bad of ['no colon', 'Bad Name: x', 'Empty:', 'A: b\r\nEvil: yes', '']) {
			expect(parseHeader(bad), bad).toBeNull();
		}
	});
});

describe('sendWebhook', () => {
	it('POSTs the filled-in body with the right content type and the extra header', async () => {
		answer();
		const config = { url: 'https://hook.example/in', body: DEFAULT_BODY, header: 'X-Key: secret' };
		expect(await sendWebhook(config, outgoing())).toEqual({ ok: true });
		const { url, init, headers } = sent();
		expect(url).toBe('https://hook.example/in');
		expect(init.method).toBe('POST');
		expect(init.redirect).toBe('manual');
		expect(headers).toEqual({ 'Content-Type': 'application/json', 'X-Key': 'secret' });
		expect(JSON.parse(String(init.body))).toEqual({
			title: 'Movie',
			message: 'In cinemas',
			url: 'https://tracker.example/movies/1'
		});
	});

	it('knows every placeholder; what there is none of becomes empty', async () => {
		answer();
		const body = '{{title}}|{{message}}|{{url}}|{{image}}|{{count}}|{{test}}';
		await sendWebhook({ url: 'https://hook.example', body, header: '' }, outgoing({ test: true }));
		expect(sent().init.body).toBe('Movie|In cinemas|https://tracker.example/movies/1||1|true');
		expect(sent().headers['Content-Type']).toBe('text/plain; charset=utf-8');
		await sendWebhook(
			{ url: 'https://hook.example', body, header: '' },
			outgoing({ link: null, image: 'https://tracker.example/img/collage?x=1', count: 3 })
		);
		expect(sent().init.body).toBe(
			'Movie|In cinemas||https://tracker.example/img/collage?x=1|3|false'
		);
	});

	it('reports what went wrong: an error answer, a redirect, not reachable', async () => {
		const config = { url: 'https://hook.example', body: 'x', header: '' };
		answer(403, 'forbidden topic');
		expect(await sendWebhook(config, outgoing())).toEqual({
			ok: false,
			error: 'HTTP 403 – forbidden topic'
		});
		answer(302);
		expect(await sendWebhook(config, outgoing())).toMatchObject({ ok: false, error: 'HTTP 302' });
		vi.mocked(fetch).mockImplementation(async () => {
			throw new Error('offline');
		});
		expect(await sendWebhook(config, outgoing())).toEqual({ ok: false, error: 'unreachable' });
	});
});

describe('a webhook as a target', () => {
	let me: number;
	const input = (fields: Record<string, string>, id: number | null = null) => ({
		id,
		kind: 'webhook',
		name: 'ntfy',
		fields: { url: 'https://ntfy.example/films', body: DEFAULT_BODY, header: '', ...fields }
	});
	beforeEach(() => {
		getDb().delete(notificationChannels).run();
		getDb().delete(users).run();
		me = getDb().insert(users).values({ username: 'me', passwordHash: 'x' }).returning().get().id;
	});

	it('is saved without asking anybody, and refused if address, body or header are no good', async () => {
		expect((await saveChannel(me, input({}))).ok).toBe(true);
		expect(fetch).not.toHaveBeenCalled();
		expect(await saveChannel(me, input({ url: 'ntfy.example' }))).toEqual({
			ok: false,
			error: 'url'
		});
		expect(await saveChannel(me, input({ body: '  ' }))).toEqual({ ok: false, error: 'body' });
		expect(await saveChannel(me, input({ header: 'no colon' }))).toEqual({
			ok: false,
			error: 'header'
		});
	});

	it('shows address and body, never the header; empty keeps it, the tick removes it', async () => {
		await saveChannel(me, input({ header: 'Authorization: Bearer abc' }));
		const [row] = listChannels(me);
		const shown = publicChannel(row);
		expect(shown.fields).toMatchObject({ url: 'https://ntfy.example/films', hasHeader: true });
		expect(JSON.stringify(shown)).not.toContain('Bearer abc');

		await saveChannel(me, input({ url: 'https://ntfy.example/series' }, row.id));
		expect(listChannels(me)[0].config).toMatchObject({
			url: 'https://ntfy.example/series',
			header: 'Authorization: Bearer abc'
		});
		await saveChannel(me, input({ clearHeader: '1' }, row.id));
		expect(listChannels(me)[0].config).toMatchObject({ header: '' });
	});

	it('gets the messages like every other target, with the link to the title', async () => {
		await saveChannel(me, input({ body: '{{title}}|{{url}}|{{count}}' }));
		answer();
		const results = await deliver(me, {
			title: 'Movie',
			body: 'In cinemas',
			url: '/movies/1',
			source: null,
			count: 1
		});
		expect(results).toMatchObject([{ name: 'ntfy', ok: true }]);
		// (No ORIGIN in tests, so there is no address to link to.)
		expect(sent().init.body).toBe('Movie||1');
	});
});
