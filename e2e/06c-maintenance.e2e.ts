import { expect, test } from '@playwright/test';
import { loginOk, saved } from './helpers';

test('maintenance: tasks are a list – a row says how a task stands, a tap unfolds the rest', async ({
	page
}) => {
	await loginOk(page);
	await page.goto('/settings/maintenance');
	const rows = page.locator('li').filter({ has: page.locator('form[action="?/toggle"]') });
	await expect(rows).toHaveCount(7);
	// Folded: no schedule, no buttons
	await expect(page.getByRole('button', { name: 'Run now' })).toHaveCount(0);
	const row = (name: string) => rows.filter({ hasText: name });

	// The switch of a row saves at once, without opening it
	const backup = row('Backup');
	await expect(backup.locator('input[name=enabled]')).not.toBeChecked();
	await expect(backup).toContainText('Switched off');
	await saved(page, 'toggle', () => backup.locator('form[action="?/toggle"] label').last().click());
	await page.reload();
	await expect(backup.locator('input[name=enabled]')).toBeChecked();
	await expect(backup).toContainText('Daily');
	// A task that cannot be switched off stays on
	const images = row('Clean up images');
	await images.locator('form[action="?/toggle"] label').last().click({ force: true });
	await expect(images.locator('input[name=enabled]')).toBeChecked();

	// Unfolded: what it does, its schedule, running it now – one row at a time
	await backup.getByRole('button', { name: 'Backup' }).first().click();
	await expect(backup.getByText('Saves a copy of the database')).toBeVisible();
	await expect(backup.getByText('No backups yet')).toBeVisible();
	await backup.getByRole('button', { name: 'Run now' }).click();
	await expect(backup.getByText('Done ✓')).toBeVisible();
	await expect(backup.getByRole('link', { name: 'Download' })).toHaveCount(1);
	await expect(backup).toContainText('Last run');

	// The schedule keeps its button: several fields belong together
	const save = backup.getByRole('button', { name: 'Save' });
	await expect(save).toBeDisabled();
	await backup.locator('select[name=frequency]').selectOption('weekly');
	await saved(page, 'save', () => save.click());
	await page.reload();
	await expect(backup).toContainText('Weekly');
	await expect(backup.locator('input[name=enabled]')).toBeChecked(); // saving kept it on

	const optimize = row('Database care');
	await backup.getByRole('button', { name: 'Backup' }).first().click();
	await optimize.getByRole('button', { name: 'Database care' }).first().click();
	await expect(backup.getByRole('button', { name: 'Run now' })).toHaveCount(0);
	await expect(optimize.getByRole('button', { name: 'Run now' })).toBeVisible();

	// Back to how it was: no backups, the usual schedule
	await backup.getByRole('button', { name: 'Backup' }).first().click();
	await backup.getByRole('button', { name: 'Back to the default schedule' }).click();
	await expect(backup).toContainText('Daily');
	await backup.getByRole('button', { name: 'Delete all' }).click();
	await backup.getByRole('button', { name: 'Really delete all?' }).click();
	await saved(page, 'toggle', () => backup.locator('form[action="?/toggle"] label').last().click());
	await expect(backup).toContainText('Switched off');
});
