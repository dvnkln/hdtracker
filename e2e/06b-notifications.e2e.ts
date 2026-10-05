import { expect, test } from '@playwright/test';
import { loginOk, saved } from './helpers';

// Push messages themselves cannot be tried here (the test browser has no push service); this
// covers what the user sets up: the form of the messages, the hour, and muting a title.
test('notifications: choose form and hour, mute a single title', async ({ page }) => {
	await loginOk(page);
	const MOVIE = '/movies/101'; // in the library since 05-dashboard
	const bell = page.getByRole('button', { name: 'Notifications about this title' });

	// Switched off: no bell on the pages of titles
	await page.goto(MOVIE);
	await expect(page.getByRole('heading', { name: 'Test Movie Alpha' })).toBeVisible();
	await expect(bell).toHaveCount(0);

	await page.goto('/settings/notifications');
	await expect(page.getByRole('heading', { name: 'This device' })).toBeVisible();
	await expect(page.getByText('No device switched on yet.')).toBeVisible();
	const prefs = page.locator('form[action="?/prefs"]');
	// Choices are saved the moment they are made – there is no button
	await expect(prefs.getByRole('button')).toHaveCount(0);
	// The hour only shows while messages are on
	await expect(prefs.locator('select[name=hour]')).toHaveCount(0);
	await saved(page, 'prefs', () => prefs.getByText('One by one').click());
	await saved(page, 'prefs', () => prefs.locator('select[name=hour]').selectOption('7'));
	await page.reload();
	await expect(prefs.locator('input[name=mode][value=single]')).toBeChecked();
	await expect(prefs.locator('select[name=hour]')).toHaveValue('7');

	// Now every title of the library has a bell; it mutes this title and remembers it
	await page.goto(MOVIE);
	await expect(bell).toHaveAttribute('aria-pressed', 'true');
	await bell.click();
	await expect(bell).toHaveAttribute('aria-pressed', 'false');
	await page.reload();
	await expect(bell).toHaveAttribute('aria-pressed', 'false');
	await bell.click();
	await expect(bell).toHaveAttribute('aria-pressed', 'true');

	// The task that sends the messages is listed with the others
	await page.goto('/settings/maintenance');
	await expect(page.getByText('Send notifications')).toBeVisible();
});
