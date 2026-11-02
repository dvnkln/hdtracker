import { expect, test } from '@playwright/test';
import { USER, login } from './helpers';

test('pages need a login, forms need the right origin, answers carry the security headers', async ({
	page,
	request
}) => {
	await page.goto('/settings/server');
	await expect(page).toHaveURL('/login');

	const response = await request.get('/login');
	const headers = response.headers();
	expect(headers['content-security-policy']).toContain("default-src 'self'");
	expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
	expect(headers['x-frame-options']).toBe('DENY');
	expect(headers['x-content-type-options']).toBe('nosniff');
	expect(headers['referrer-policy']).toBe('same-origin');

	const foreign = await request.post('/login', {
		headers: { Origin: 'https://evil.example' },
		form: { username: USER.name, password: USER.password }
	});
	expect(foreign.status()).toBe(403);

	// Without a login only small forms are taken (the large limit is for the import)
	const origin = new URL(page.url()).origin;
	const large = await request.post('/login', {
		headers: { Origin: origin },
		form: { username: USER.name, password: 'x'.repeat(100_000) }
	});
	expect(large.status()).toBe(413);
});

// Last test: the block stays in the server's memory.
// Wrong passwords of earlier tests still count (logging in does not reset the count): the
// block has to come at the fifth wrong password at the latest.
test('five wrong passwords block the address', async ({ page }) => {
	const wrong = page.getByText('Wrong username or password');
	const blocked = page.getByText(/Too many failed attempts/);
	let tries = 0;
	for (; tries < 5; tries++) {
		await login(page, `wrong-${tries}`);
		await expect(wrong.or(blocked)).toBeVisible();
		if (await blocked.isVisible()) break;
	}
	expect(tries).toBeGreaterThan(0);
	expect(tries).toBeLessThanOrEqual(5);
	// Even the right password is refused now
	await login(page);
	await expect(page.getByText(/Too many failed attempts/)).toBeVisible();
	await expect(page).toHaveURL('/login');
});
