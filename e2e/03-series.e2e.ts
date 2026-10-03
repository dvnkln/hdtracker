import { expect, test } from '@playwright/test';
import { loginOk, openSeason, sheet } from './helpers';

test('series: add, tick an episode and a season; all watched sets the status', async ({ page }) => {
	await loginOk(page);
	await page.goto('/series/201');
	await expect(page.getByRole('heading', { name: 'Test Series Gamma' })).toBeVisible();

	await page.getByRole('button', { name: 'Add to library' }).click();
	await sheet(page).getByRole('button', { name: 'Planned', exact: true }).click();
	await expect(sheet(page)).toHaveCount(0);
	await expect(page.getByText('0 / 4 episodes watched')).toBeVisible();

	// First episode ticked: the status becomes "Watching" by itself
	const season1 = await openSeason(page, 'Season 1');
	await season1.getByRole('button', { name: /Episode 1/ }).click();
	await expect(page.getByText('1 / 4 episodes watched')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Watching', exact: true })).toBeVisible();

	await season1.getByRole('button', { name: 'Watched whole season' }).click();
	await expect(page.getByText('2 / 4 episodes watched')).toBeVisible();

	// Everything of an ended series watched: the status becomes "Watched"
	const season2 = await openSeason(page, 'Season 2');
	await season2.getByRole('button', { name: 'Watched whole season' }).click();
	await expect(page.getByText('4 / 4 episodes watched')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Watched', exact: true })).toBeVisible();

	// The progress survives a reload (it comes from the database)
	await page.reload();
	await expect(page.getByText('4 / 4 episodes watched')).toBeVisible();
});
