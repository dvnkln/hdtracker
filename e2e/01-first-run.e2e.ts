import { expect, test } from '@playwright/test';
import { USER, login } from './helpers';

test('first start: set-up wizard, log out, wrong password, log in', async ({ page }) => {
	// A new installation leads everything to the wizard
	await page.goto('/');
	await expect(page).toHaveURL('/setup');
	await page.locator('input[name=username]').fill(USER.name);
	await page.locator('input[name=password]').fill(USER.password);
	await page.locator('input[name=confirm]').fill(USER.password);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	// The dashboard of an empty library explains what will show up here
	await expect(page.getByText(/show up here/)).toBeVisible();

	// The wizard is gone once the account exists
	await page.goto('/setup');
	await expect(page).toHaveURL('/');

	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page).toHaveURL('/login');

	await login(page, 'not-the-password');
	await expect(page.getByText('Wrong username or password')).toBeVisible();
	await expect(page).toHaveURL('/login');

	await login(page);
	await expect(page).toHaveURL('/');
});
