import { expect, test } from '@playwright/test';
import { addTitle, loginOk, sheet } from './helpers';

test('movie: search, add, change status, remove', async ({ page }) => {
	await loginOk(page);
	await addTitle(page, 'movies', 'Test Movie Alpha', 'Planned');

	// It stands in the "Planned" section of the library
	await page.goto('/movies');
	const section = (name: string) =>
		page.locator('details').filter({ has: page.getByRole('heading', { name, exact: true }) });
	await expect(section('Planned').getByRole('button', { name: 'Test Movie Alpha' })).toBeVisible();

	// Change the status
	await section('Planned').getByRole('button', { name: 'Test Movie Alpha' }).click();
	await sheet(page).getByRole('button', { name: 'Watched', exact: true }).click();
	await expect(sheet(page)).toHaveCount(0);
	await expect(section('Planned')).toHaveCount(0);
	// "Watched" starts collapsed
	await section('Watched').locator('summary').click();
	await expect(section('Watched').getByRole('button', { name: 'Test Movie Alpha' })).toBeVisible();

	// The detail page shows where to watch it (from the fake TMDB / JustWatch data)
	await page.goto('/movies/101');
	await expect(page.getByRole('heading', { name: 'Test Movie Alpha' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Where to watch' })).toBeVisible();

	// Remove it again (asks once more)
	await page.goto('/movies');
	await section('Watched').locator('summary').click();
	await section('Watched').getByRole('button', { name: 'Test Movie Alpha' }).click();
	await sheet(page).getByRole('button', { name: 'Remove from library' }).click();
	await sheet(page).getByRole('button', { name: 'Really remove from library?' }).click();
	await expect(page.getByText('Your library is still empty')).toBeVisible();
});
