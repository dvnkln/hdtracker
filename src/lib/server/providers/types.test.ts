import { describe, expect, it, vi } from 'vitest';
import { serverMessages } from '../i18n';
import { fetchJson, reasonOf } from './types';

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

	it('says "too many requests" in words', async () => {
		answer(429, '');
		expect(await failure('AniList')).toBe(m().tooMany('AniList'));
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
