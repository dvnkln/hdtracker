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
	// The trailer is a link to the video site – the trailer, not some clip
	await expect(page.getByRole('link', { name: 'Trailer' })).toHaveAttribute(
		'href',
		'https://www.youtube.com/watch?v=trailAlpha1'
	);

	// Remove it again (asks once more)
	await page.goto('/movies');
	await section('Watched').locator('summary').click();
	await section('Watched').getByRole('button', { name: 'Test Movie Alpha' }).click();
	await sheet(page).getByRole('button', { name: 'Remove from library' }).click();
	await sheet(page).getByRole('button', { name: 'Really remove from library?' }).click();
	await expect(page.getByText('No movies yet')).toBeVisible();
});

test('search on a phone: the x only empties the field', async ({ page }) => {
	await loginOk(page);
	await page.setViewportSize({ width: 412, height: 800 });
	await page.goto('/movies');
	await page.getByRole('button', { name: 'Search' }).click();
	const panel = page.locator('[data-search-panel]');
	const field = panel.getByRole('searchbox');
	await field.fill('Test Movie Alpha');
	await field.press('Enter');
	await expect(page).toHaveURL(/q=Test/);
	await expect(page.getByRole('button', { name: 'Test Movie Alpha' })).toBeVisible();

	// Open the panel again and empty the field: it stays open, focused, results behind it stay
	await page.getByRole('button', { name: 'Search' }).click();
	await panel.getByRole('button', { name: 'Clear' }).click();
	await expect(field).toHaveValue('');
	await expect(field).toBeFocused();
	await expect(page).toHaveURL(/q=Test/);
	await expect(panel).not.toHaveAttribute('inert');

	// A new search right away
	await field.fill('Future Film');
	await field.press('Enter');
	await expect(page).toHaveURL(/q=Future/);
});
