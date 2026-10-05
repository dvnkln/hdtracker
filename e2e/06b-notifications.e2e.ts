import { expect, test } from '@playwright/test';
import { loginOk, saved } from './helpers';

// The one application token the fake Pushover accepts (same value as in fixtures.mjs)
const PUSHOVER_TOKEN = 'tokentokentokentokentokentoken';

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

test('notifications: targets are one list – add Pushover, a webhook and ntfy, switch off and on, test, remove', async ({
	page
}) => {
	await loginOk(page);
	await page.goto('/settings/notifications');
	const targets = page
		.locator('section')
		.filter({ has: page.getByRole('heading', { name: 'Targets' }) });
	await expect(targets.getByText('No target yet.')).toBeVisible();

	// Adding asks for the kind first. "This device" cannot work in this browser: greyed out
	await targets.getByRole('button', { name: 'Add a target' }).click();
	await expect(targets.getByRole('button', { name: /This device/ })).toBeDisabled();
	await targets.getByRole('button', { name: /Pushover/ }).click();

	// Token and key are checked at Pushover before anything is saved
	const add = targets.locator('form[action="?/channelSave"]');
	await add.getByLabel('Name', { exact: true }).fill('Living room');
	await add.getByLabel('App token').fill('wrongwrongwrongwrongwrongwrong');
	await add.getByLabel('User key').fill('useruseruseruseruseruseruserus');
	await add.getByRole('button', { name: 'Save' }).click();
	await expect(
		targets.getByText('Pushover refuses these details: application token is invalid')
	).toBeVisible();
	await add.getByLabel('App token').fill(PUSHOVER_TOKEN);
	await saved(page, 'channelSave', () => add.getByRole('button', { name: 'Save' }).click());

	// It is in the list now, opened; the devices Pushover reported can be tapped into the filter
	const row = targets.getByRole('listitem').filter({ hasText: 'Living room' });
	const edit = row.locator('form[action="?/channelSave"]');
	await expect(edit.getByLabel('Only to these devices')).toHaveValue('');
	const filter = edit.getByLabel('Only to these devices');
	const chip = (name: string) => row.getByRole('button', { name, exact: true });
	await chip('tablet').click();
	await chip('phone').click();
	await expect(filter).toHaveValue('tablet,phone');
	// A second tap takes a name out again; names in the field light up as chosen
	await chip('phone').click();
	await expect(filter).toHaveValue('tablet');
	await expect(chip('tablet')).toHaveAttribute('aria-pressed', 'true');
	await expect(chip('phone')).toHaveAttribute('aria-pressed', 'false');
	await saved(page, 'channelSave', () => edit.getByRole('button', { name: 'Save' }).click());

	// A test goes to this target only
	await row.getByRole('button', { name: 'Test' }).click();
	await expect(row.getByText('Sent ✓')).toBeVisible();

	// Switched off: still there with everything about it – the keys are never shown again
	// (the switch is a hidden checkbox: it is operated through the label drawn around it)
	const toggle = row.locator('input[name=enabled]');
	const flip = row.locator('form[action="?/targetToggle"] label').last();
	await saved(page, 'targetToggle', () => flip.click());
	await expect(toggle).not.toBeChecked();
	await page.reload();
	await expect(toggle).not.toBeChecked();
	await row.getByRole('button', { name: /Living room/ }).click();
	await expect(edit.getByLabel('Only to these devices')).toHaveValue('tablet');
	await expect(edit.getByLabel('App token')).toHaveValue('');
	await saved(page, 'targetToggle', () => flip.click());
	await expect(toggle).toBeChecked();

	await saved(page, 'targetRemove', () => row.getByRole('button', { name: 'Remove' }).click());
	await expect(targets.getByText('No target yet.')).toBeVisible();

	// A webhook: address and content with placeholders; a test says what the other side answered
	await targets.getByRole('button', { name: 'Add a target' }).click();
	await targets.getByRole('button', { name: /Webhook/ }).click();
	const hook = targets.locator('form[action="?/channelSave"]');
	await expect(hook.getByLabel('Content')).toHaveValue(/"title": "{{title}}"/);
	await hook.getByLabel('Address').fill('https://hook.test/denied');
	await saved(page, 'channelSave', () => hook.getByRole('button', { name: 'Save' }).click());
	const hookRow = targets.getByRole('listitem').filter({ hasText: 'Webhook' });
	await hookRow.getByRole('button', { name: 'Test' }).click();
	await expect(hookRow.getByText('Not delivered: HTTP 403')).toBeVisible();
	await hookRow
		.locator('form[action="?/channelSave"]')
		.getByLabel('Address')
		.fill('https://hook.test/in');
	await saved(page, 'channelSave', () =>
		hookRow.locator('form[action="?/channelSave"]').getByRole('button', { name: 'Save' }).click()
	);
	await hookRow.getByRole('button', { name: 'Test' }).click();
	await expect(hookRow.getByText('Sent ✓')).toBeVisible();
	await saved(page, 'targetRemove', () => hookRow.getByRole('button', { name: 'Remove' }).click());
	await expect(targets.getByText('No target yet.')).toBeVisible();

	// ntfy: a server (ntfy.sh unless changed) and a topic; the test says why ntfy refuses
	await targets.getByRole('button', { name: 'Add a target' }).click();
	await targets.getByRole('button', { name: /ntfy/ }).click();
	const ntfy = targets.locator('form[action="?/channelSave"]');
	await expect(ntfy.getByLabel('Server')).toHaveValue('https://ntfy.sh');
	await expect(ntfy.getByRole('button', { name: 'Save' })).toBeDisabled();
	await ntfy.getByRole('textbox', { name: /^Topic/ }).fill('locked');
	await saved(page, 'channelSave', () => ntfy.getByRole('button', { name: 'Save' }).click());
	const ntfyRow = targets.getByRole('listitem').filter({ hasText: 'ntfy' });
	const ntfyEdit = ntfyRow.locator('form[action="?/channelSave"]');
	await ntfyRow.getByRole('button', { name: 'Test' }).click();
	await expect(ntfyRow.getByText('Not delivered: HTTP 403 – forbidden')).toBeVisible();
	await ntfyEdit.getByRole('textbox', { name: /^Topic/ }).fill('hdtracker-e2e');
	await saved(page, 'channelSave', () => ntfyEdit.getByRole('button', { name: 'Save' }).click());
	await ntfyRow.getByRole('button', { name: 'Test' }).click();
	await expect(ntfyRow.getByText('Sent ✓')).toBeVisible();
	await saved(page, 'targetRemove', () => ntfyRow.getByRole('button', { name: 'Remove' }).click());
	await expect(targets.getByText('No target yet.')).toBeVisible();
});
