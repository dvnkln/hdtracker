import { expect, test } from '@playwright/test';
import { loginOk, saved } from './helpers';

test('settings: language, theme and hidden areas are kept', async ({ page }) => {
	await loginOk(page);

	// Choices are saved the moment they are made – there is no "Save" button
	await page.goto('/settings/general');
	const display = page.locator('form[action="?/display"]');
	await expect(display.getByRole('button')).toHaveCount(0);
	await display.locator('select[name=uiLanguage]').selectOption('de');
	await expect(page.getByRole('heading', { name: 'Allgemein' })).toBeVisible();
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('lang', 'de');

	// ... and back to English for the following tests
	const anzeige = page.locator('form[action="?/display"]');
	await anzeige.locator('select[name=uiLanguage]').selectOption('en');
	await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

	// Two quick choices in a row: both arrive, the last one counts
	// (wait for the save that carries both: Romaji, and no spoiler protection any more)
	await anzeige.getByText('Romaji on top').click();
	await saved(
		page,
		'display',
		() => anzeige.locator('label[for=hideSpoilers]').click(),
		(body) => body.includes('romaji') && !body.includes('hideSpoilers')
	);
	await page.reload();
	await expect(anzeige.locator('input[name=animeTitle][value=romaji]')).toBeChecked();
	await expect(anzeige.locator('input[name=hideSpoilers]')).not.toBeChecked();
	await saved(page, 'display', () => anzeige.getByText('English title on top').click());
	await saved(page, 'display', () => anzeige.locator('label[for=hideSpoilers]').click());
	await expect(anzeige.locator('input[name=hideSpoilers]')).toBeChecked();

	// Theme: applied at once and still there after a reload
	await page.goto('/settings/appearance');
	await page.locator('input[name=theme][value=retro95]').check();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'retro95');
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'retro95');
	await page.locator('input[name=theme][value=dark]').check();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

	// A hidden area disappears from the navigation and cannot be opened
	await page.goto('/settings/general');
	const areas = page.locator('form[action="?/areas"]');
	// (the switch is a hidden checkbox: it is operated through its label)
	const games = areas.locator('input[name=categories][value=games]');
	await areas.locator('label[for=area-games]').click();
	await expect(games).not.toBeChecked();
	const nav = page.locator('nav');
	await expect(nav.getByRole('link', { name: 'Games' })).toHaveCount(0);
	await page.goto('/games');
	await expect(page).toHaveURL('/');

	await page.goto('/settings/general');
	await page.locator('form[action="?/areas"] label[for=area-games]').click();
	await expect(page.locator('nav').getByRole('link', { name: 'Games' })).toBeVisible();
});
