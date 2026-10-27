import { expect, test } from '@playwright/test';
import { loginOk, sheet } from './helpers';

// A data source that fails does not lead to an error page: the user stays where they were and
// reads why at the top (see guardNavigation.svelte.ts). The fake TMDB fails for these on purpose.
test('a failing data source: stay on the page, a message at the top', async ({ page }) => {
	await loginOk(page);
	const alert = page.getByRole('alert');

	// A detail page that cannot be loaded: the search with its window stays
	await page.goto('/movies?q=Shaky');
	await page.getByRole('button', { name: 'Shaky Movie' }).click();
	await sheet(page).getByRole('link', { name: 'Details' }).click();
	await expect(alert).toContainText('TMDB responded with error 503.');
	await expect(page).toHaveURL(/\/movies\?q=Shaky$/);
	await expect(sheet(page)).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Something went wrong' })).toHaveCount(0);

	// It lies above the open window (the browser keeps everything but the window untouchable,
	// so it goes by itself there); without a window a tap closes it
	await expect(alert.getByRole('button')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(sheet(page)).toHaveCount(0);
	await alert.getByRole('button').click();
	await expect(alert.getByRole('button')).toHaveCount(0);

	// A search that cannot be done: the page stays as it was
	await page.goto('/movies');
	await page.getByRole('searchbox').first().fill('Overloaded');
	await page.getByRole('searchbox').first().press('Enter');
	await expect(alert).toContainText('TMDB responded with error 503.');
	await expect(page).toHaveURL(/\/movies$/);

	// Opened directly, the error page still says what happened
	await page.goto('/movies/998');
	await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
	await expect(page.getByText('TMDB responded with error 503.')).toBeVisible();
});
