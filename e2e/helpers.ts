import { expect, type Locator, type Page } from '@playwright/test';

// The one account of the test installation (created by 01-first-run).
export const USER = { name: 'tester', password: 'e2e-password-12345' };

export async function login(page: Page, password = USER.password) {
	await page.goto('/login');
	await page.locator('input[name=username]').fill(USER.name);
	await page.locator('input[name=password]').fill(password);
	await page.getByRole('button', { name: 'Log in' }).click();
}

export async function loginOk(page: Page) {
	await login(page);
	await expect(page).toHaveURL('/');
}

// The window that opens when a poster is tapped (status tiles, remove).
export const sheet = (page: Page) => page.locator('dialog[open]');

// Search for a title in an area, tap it and choose a status.
export async function addTitle(page: Page, area: string, title: string, status: string) {
	await page.goto(`/${area}?q=${encodeURIComponent(title)}`);
	await page.getByRole('button', { name: title }).click();
	await sheet(page).getByRole('button', { name: status, exact: true }).click();
	await expect(sheet(page)).toHaveCount(0);
}

// Settings without a "Save" button: do something and wait until the server has stored it.
// `sent` picks the request that counts when several are on their way (what the form sent).
export async function saved(
	page: Page,
	action: string,
	change: () => Promise<unknown>,
	sent: (body: string) => boolean = () => true
) {
	const answer = page.waitForResponse(
		(res) =>
			res.request().method() === 'POST' &&
			res.url().includes(`?/${action}`) &&
			sent(res.request().postData() ?? '')
	);
	await change();
	expect((await answer).ok()).toBe(true);
}

// A season of the episode list; opens it if it is closed.
export async function openSeason(page: Page, name: string): Promise<Locator> {
	const season = page.locator('details').filter({ has: page.getByRole('heading', { name }) });
	if (!(await season.evaluate((d: HTMLDetailsElement) => d.open))) {
		await season.locator('summary').click();
	}
	return season;
}
