import { expect, test } from '@playwright/test';
import { loginOk } from './helpers';

test('the library can be filtered by genre and streaming service; the address remembers it', async ({
	page
}) => {
	await loginOk(page);
	await page.goto('/movies');
	const alpha = page.getByRole('button', { name: /Test Movie Alpha/ });
	const beta = page.getByRole('button', { name: /Future Film Beta/ });
	await expect(alpha).toBeVisible();
	await expect(beta).toBeVisible();

	// The funnel sits in the line of the first heading and takes no line of its own
	const funnel = page.getByRole('button', { name: 'Filter', exact: true });
	const heading = page.locator('main summary h2').first();
	await expect(funnel).toBeVisible();
	const [f, h] = [(await funnel.boundingBox())!, (await heading.boundingBox())!];
	expect(Math.abs(f.y + f.height / 2 - (h.y + h.height / 2))).toBeLessThan(8);

	// A genre: only the titles that have it stay; the window stays open while choosing
	await funnel.click();
	const window = page.locator('dialog[open]');
	await window.getByRole('checkbox', { name: /^Drama/ }).click();
	await expect(window.getByRole('button', { name: 'Show 1 title' })).toBeVisible();
	await window.getByRole('button', { name: 'Show 1 title' }).click();
	await expect(alpha).toBeVisible();
	await expect(beta).toHaveCount(0);
	await expect(page).toHaveURL(/f=genre(%3A|:)Drama/);
	await expect(page.getByRole('button', { name: 'Remove the filter “Drama”' })).toBeVisible();

	// ... still there after a reload and after a look at a title
	await page.reload();
	await expect(alpha).toBeVisible();
	await expect(beta).toHaveCount(0);

	// A streaming service on top: both have to fit
	await funnel.click();
	await window.getByRole('checkbox', { name: 'Netflix' }).click();
	await window.getByRole('button', { name: 'Show 1 title' }).click();
	await expect(alpha).toBeVisible();

	// Taking the filters away shows everything again; another area starts without filters
	await page.getByRole('button', { name: 'Clear all filters' }).click();
	await expect(beta).toBeVisible();
	await expect(page).not.toHaveURL(/f=/);
	await funnel.click();
	await window.getByRole('checkbox', { name: /^Drama/ }).click();
	await window.getByRole('button', { name: 'Close' }).click();
	await page.locator('nav').getByRole('link', { name: 'Series' }).click();
	await expect(page).toHaveURL('/series');
	await expect(page.getByRole('button', { name: /^Remove the filter/ })).toHaveCount(0);
});
