import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serverMessages } from '../i18n';
import { fetchJson, forgetRateLimits, reasonOf, runInBackground } from './types';

const answer = (status: number, body: unknown) =>
	vi
		.mocked(fetch)
		.mockResolvedValue(
			new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
		);
const failure = (source: string) =>
	fetchJson(source, 'https://example.test').then(
		() => '',
		(err: Error) => err.message
	);

describe('error messages of the data sources', () => {
	const m = () => serverMessages().errors;

	it('points to .env only for services that need a key', async () => {
		answer(401, { status_code: 7, status_message: 'Invalid API key' });
		const tmdb = await failure('TMDB');
		expect(tmdb).toContain(m().badCredentials('TMDB'));
		expect(tmdb).toContain('Invalid API key');

		// AniList works without a key: a refusal is never about .env
		answer(403, {
			errors: [{ message: 'The AniList API has been temporarily disabled.', status: 403 }],
			data: null
		});
		const anilist = await failure('AniList');
		expect(anilist).not.toContain('.env');
		expect(anilist).toBe(
			`${m().refused('AniList')} ${m().reason('AniList', 'The AniList API has been temporarily disabled.')}`
		);
	});

	it('says "too many requests" in words, with the time to wait', async () => {
		forgetRateLimits();
		answer(429, '');
		expect(await failure('AniList')).toBe(m().tooManyWait('AniList', 60));
		forgetRateLimits();
	});

	it('names the status code for other errors, without markup from an HTML page', async () => {
		answer(502, '<html><body>Bad gateway</body></html>');
		expect(await failure('Wikidata')).toBe(m().httpError('Wikidata', 502));
	});

	it('says so when an "ok" answer is not data', async () => {
		answer(200, '<html><body>Down for maintenance</body></html>');
		expect(await failure('TMDB')).toBe(m().garbled('TMDB'));
	});
});

describe('reasonOf', () => {
	it('reads the shapes the services use', () => {
		expect(reasonOf('{"errors":[{"message":"disabled"}]}')).toBe('disabled');
		expect(reasonOf('{"status_message":"Invalid API key"}')).toBe('Invalid API key');
		expect(reasonOf('{"status":403,"message":"invalid client secret"}')).toBe(
			'invalid client secret'
		);
		expect(reasonOf('[{"title":"Syntax Error","status":400,"cause":"bad field"}]')).toBe(
			'bad field'
		);
	});

	it('gives nothing for empty or unknown answers and shortens long ones', () => {
		expect(reasonOf('')).toBeNull();
		expect(reasonOf('<html>oops</html>')).toBeNull();
		expect(reasonOf('{"errors":[]}')).toBeNull();
		expect(reasonOf('null')).toBeNull();
		const long = reasonOf(JSON.stringify({ message: 'x '.repeat(300) }))!;
		expect(long.length).toBe(200);
		expect(long.endsWith('…')).toBe(true);
	});
});

describe('too many requests', () => {
	const m = () => serverMessages().errors;
	// A new answer for every request (a body can only be read once)
	function replies(...list: { status: number; headers?: Record<string, string> }[]) {
		const queue = [...list];
		vi.mocked(fetch).mockImplementation(async () => {
			const next = queue.length > 1 ? queue.shift()! : queue[0];
			return new Response(next.status === 200 ? '{"ok":true}' : '', next);
		});
	}
	const sent = () => vi.mocked(fetch).mock.calls.length;

	beforeEach(() => {
		forgetRateLimits();
		vi.mocked(fetch).mockReset();
		vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
	});
	afterEach(() => {
		vi.useRealTimers();
		forgetRateLimits();
	});

	it('sends nothing more while the service is blocking, and says how long', async () => {
		replies({ status: 429, headers: { 'Retry-After': '30' } });
		expect(await failure('AniList')).toBe(m().tooManyWait('AniList', 30));
		expect(sent()).toBe(1);

		// Ten seconds later: no request, the time left
		vi.advanceTimersByTime(10_000);
		expect(await failure('AniList')).toBe(m().tooManyWait('AniList', 20));
		expect(sent()).toBe(1);
		// Other services are not affected
		replies({ status: 200 });
		await expect(fetchJson('TMDB', 'https://example.test')).resolves.toEqual({ ok: true });

		// Once the time is over, requests go out again
		vi.advanceTimersByTime(20_000);
		await expect(fetchJson('AniList', 'https://example.test')).resolves.toEqual({ ok: true });
	});

	it('blocks other services only briefly when they do not say how long', async () => {
		replies({ status: 429 });
		expect(await failure('IGDB')).toBe(m().tooManyWait('IGDB', 3));
		vi.advanceTimersByTime(3_000);
		replies({ status: 200 });
		await expect(fetchJson('IGDB', 'https://example.test')).resolves.toEqual({ ok: true });
	});

	it('reads the time from X-RateLimit-Reset when there is no Retry-After', async () => {
		const reset = Math.floor(Date.now() / 1000) + 45;
		replies({ status: 429, headers: { 'X-RateLimit-Reset': String(reset) } });
		expect(await failure('AniList')).toBe(m().tooManyWait('AniList', 45));
	});

	it('lets background work wait for the end of the block and try again', async () => {
		replies({ status: 429, headers: { 'Retry-After': '20' } }, { status: 200 });
		const result = runInBackground(() => fetchJson('AniList', 'https://example.test'));
		await vi.advanceTimersByTimeAsync(19_000);
		expect(sent()).toBe(1);
		await vi.advanceTimersByTimeAsync(5_000);
		await expect(result).resolves.toEqual({ ok: true });
		expect(sent()).toBe(2);
	});

	it('keeps the last requests of a minute for the user', async () => {
		replies({ status: 200, headers: { 'X-RateLimit-Remaining': '8' } });
		await fetchJson('AniList', 'https://example.test');
		expect(sent()).toBe(1);

		// Background work waits for the next minute ...
		const background = runInBackground(() => fetchJson('AniList', 'https://example.test'));
		await vi.advanceTimersByTimeAsync(30_000);
		expect(sent()).toBe(1);
		// ... while a search still goes out at once
		replies({ status: 200, headers: { 'X-RateLimit-Remaining': '7' } });
		await fetchJson('AniList', 'https://example.test');
		expect(sent()).toBe(2);

		await vi.advanceTimersByTimeAsync(35_000);
		await expect(background).resolves.toEqual({ ok: true });
		expect(sent()).toBe(3);
	});

	it('waits again when it is still low a minute later', async () => {
		replies({ status: 200, headers: { 'X-RateLimit-Remaining': '5' } });
		await fetchJson('AniList', 'https://example.test');
		const first = runInBackground(() => fetchJson('AniList', 'https://example.test'));
		await vi.advanceTimersByTimeAsync(61_000);
		await first;
		expect(sent()).toBe(2);
		// That answer still said 5: the next background request waits another minute
		const second = runInBackground(() => fetchJson('AniList', 'https://example.test'));
		await vi.advanceTimersByTimeAsync(30_000);
		expect(sent()).toBe(2);
		await vi.advanceTimersByTimeAsync(31_000);
		await second;
		expect(sent()).toBe(3);
	});
});
