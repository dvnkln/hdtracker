import { expect, test } from '@playwright/test';
import { addTitle, loginOk } from './helpers';

test('dashboard: recent and upcoming dates of the library, reversible order', async ({ page }) => {
	await loginOk(page);
	// A movie that came out 10 days ago and an airing anime join the planned future film
	await addTitle(page, 'movies', 'Test Movie Alpha', 'Planned');
	await addTitle(page, 'anime', 'Test Anime Delta', 'Watching');

	await page.goto('/');
	const section = (name: string) =>
		page.locator('section').filter({ has: page.getByRole('heading', { name }) });
	// Details are loaded in the background right after adding
	await expect(section('Recently released').getByText('Test Movie Alpha')).toBeVisible();
	await expect(section('Recently released').getByText('Test Anime Delta')).toBeVisible();
	await expect(section('Coming up').getByText('Future Film Beta')).toBeVisible();
	await expect(section('Coming up').getByText('Test Anime Delta')).toBeVisible();

	// Upcoming: next first (anime episode in 3 days before the film in 30) – then reversed
	const titles = () => section('Coming up').getByRole('link').allInnerTexts();
	const first = async () => (await titles())[0];
	expect(await first()).toContain('Test Anime Delta');
	await section('Coming up')
		.getByRole('button', { name: /reverse order/ })
		.click();
	await expect.poll(first).toContain('Future Film Beta');
	// The choice is remembered
	await page.reload();
	expect(await first()).toContain('Future Film Beta');
});
