import { afterEach, expect, it, vi } from 'vitest';

// origins.ts reads the configured addresses when it is loaded.
async function load(origins: string) {
	vi.resetModules();
	vi.stubEnv('HDTRACKER_ORIGINS', origins);
	return import('./origins');
}
afterEach(() => vi.unstubAllEnvs());

const url = new URL('http://192.168.1.50:3000/login');
const request = (host: string) => new Request(url, { headers: { host } });

it('accepts form posts only from a configured address', async () => {
	const { isAllowedOrigin } = await load('http://192.168.1.50:3000, https://tracker.example.com/');
	expect(isAllowedOrigin('http://192.168.1.50:3000', url)).toBe(true);
	expect(isAllowedOrigin('https://tracker.example.com', url)).toBe(true);
	expect(isAllowedOrigin('https://evil.example', url)).toBe(false);
	expect(isAllowedOrigin(null, url)).toBe(false);
});

it('without configured addresses only the address of the request itself counts', async () => {
	const { isAllowedOrigin } = await load('');
	expect(isAllowedOrigin('http://192.168.1.50:3000', url)).toBe(true);
	expect(isAllowedOrigin('https://tracker.example.com', url)).toBe(false);
});

it('knows whether the browser came via https', async () => {
	const { isHttps } = await load('http://192.168.1.50:3000,https://tracker.example.com');
	expect(isHttps(request('tracker.example.com'), url)).toBe(true);
	expect(isHttps(request('192.168.1.50:3000'), url)).toBe(false);
});
