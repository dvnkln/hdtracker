import { expect, test } from '@playwright/test';
import { loginOk, sheet } from './helpers';

test('a title that is not out yet can only be planned', async ({ page }) => {
	await loginOk(page);
	await page.goto('/movies?q=Future%20Film');
	await page.getByRole('button', { name: 'Future Film Beta' }).click();

	const tile = (name: string) => sheet(page).getByRole('button', { name, exact: true });
	await expect(tile('Planned')).toHaveAttribute('aria-disabled', 'false');
	await expect(tile('Watched')).toHaveAttribute('aria-disabled', 'true');
	await expect(tile('Dropped')).toHaveAttribute('aria-disabled', 'true');

	// A single tap on a locked tile explains, but saves nothing
	await tile('Watched').click({ force: true });
	await expect(sheet(page)).toBeVisible();

	await tile('Planned').click();
	await expect(sheet(page)).toHaveCount(0);
	await page.goto('/movies');
	await expect(page.getByRole('button', { name: 'Future Film Beta' })).toBeVisible();
});
