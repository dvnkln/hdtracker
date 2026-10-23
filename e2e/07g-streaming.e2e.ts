import { expect, test } from '@playwright/test';
import { loginOk, sheet } from './helpers';

// The streaming overview: what one wants to watch, by service. Test Movie Alpha streams at
// Netflix (fixtures); changing its status in the window of the overview takes it off there.
test('streaming overview: tiles by service, status changed in place', async ({ page }) => {
	await loginOk(page);
	// Alpha planned for the time of this test
	await page.goto('/movies');
	const alpha = page.getByRole('button', { name: /Test Movie Alpha/ });
	await alpha.click();
	const before = await sheet(page).locator('button[name=status][aria-pressed=true]').textContent();
	await sheet(page).getByRole('button', { name: 'Planned', exact: true }).click();
	await expect(sheet(page)).toHaveCount(0);

	// The icon in the header leads to the tiles
	await page.getByRole('link', { name: 'What runs where' }).click();
	await expect(page).toHaveURL('/streaming');
	await expect(page.getByRole('heading', { name: 'Streaming', level: 1 })).toBeVisible();
	const netflix = page.getByRole('link', { name: /Netflix/ });
	await expect(netflix).toContainText('1 title');

	// A tile shows the posters of that service, by area; the way back leads to the tiles
	await netflix.click();
	await expect(page).toHaveURL('/streaming?s=Netflix');
	await expect(page.getByRole('heading', { name: 'Netflix', level: 1 })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Movies', level: 2 })).toBeVisible();
	await page.goBack();
	await expect(page.getByRole('heading', { name: 'Streaming', level: 1 })).toBeVisible();
	await netflix.click();

	// Watched in the window of the overview: saved, the title leaves the service – and with it
	// gone, the page is back at the tiles (without the old address)
	await page.getByRole('button', { name: /Test Movie Alpha/ }).click();
	await sheet(page).getByRole('button', { name: 'Watched', exact: true }).click();
	await expect(sheet(page)).toHaveCount(0);
	await expect(page).toHaveURL('/streaming');
	await expect(page.getByRole('heading', { name: 'Streaming', level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: /Netflix/ })).toHaveCount(0);

	// Alpha back to what it was
	await page.goto('/movies');
	// (watched titles are folded away: unfold them like a user, once the page is ready for it)
	await expect(async () => {
		if (!(await alpha.isVisible())) await page.getByRole('heading', { name: 'Watched' }).click();
		await expect(alpha).toBeVisible({ timeout: 1000 });
	}).toPass();
	await alpha.click();
	await sheet(page).getByRole('button', { name: before!.trim(), exact: true }).click();
	await expect(sheet(page)).toHaveCount(0);
});
