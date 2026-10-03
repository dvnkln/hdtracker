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
});

// Last test: the block stays in the server's memory.
test('five wrong passwords block the address', async ({ page }) => {
	for (let i = 0; i < 5; i++) {
		await login(page, `wrong-${i}`);
		await expect(page.getByText('Wrong username or password')).toBeVisible();
	}
	// Even the right password is refused now
	await login(page);
	await expect(page.getByText(/Too many failed attempts/)).toBeVisible();
	await expect(page).toHaveURL('/login');
});
