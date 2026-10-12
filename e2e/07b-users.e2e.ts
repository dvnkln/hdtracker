import { expect, test, type Page } from '@playwright/test';
import { addTitle, loginOk, saved } from './helpers';

// A second account, created by the admin in this test and removed again at its end.
const GUEST = { name: 'guest', password: 'guest-password-6789' };

// A tiny picture to upload (2×2 pixels, red)
const PICTURE = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAE0lEQVQImWP4z8DwnwGM/zMwAAAf7gP9qS/A4gAAAABJRU5ErkJggg==',
	'base64'
);

// The posters of a library page
const posters = (page: Page) => page.locator('main [class*="group/poster"]');

async function loginAs(page: Page, name: string, password: string) {
	await page.goto('/login');
	await page.locator('input[name=username]').fill(name);
	await page.locator('input[name=password]').fill(password);
	await page.getByRole('button', { name: 'Log in' }).click();
}

test('users: the admin creates an account; it starts with a temporary password, an empty library and no admin rights; locking and deleting', async ({
	page,
	browser
}) => {
	await loginOk(page);
	await page.goto('/settings/users');
	const accounts = page
		.locator('section')
		.filter({ has: page.getByRole('heading', { name: 'Accounts' }) });
	await expect(accounts.getByRole('listitem')).toHaveCount(1);
	await expect(accounts.getByText('tester')).toBeVisible();
	await expect(accounts.getByText('· you')).toBeVisible();

	// A name is all it takes; a name that exists is refused
	await accounts.getByRole('button', { name: 'Add a user' }).click();
	const create = accounts.getByRole('button', { name: 'Create' });
	await expect(create).toBeDisabled();
	await accounts.getByLabel('Username').fill('TESTER');
	await create.click();
	await expect(accounts.getByText('This username already exists.')).toBeVisible();
	await accounts.getByLabel('Username').fill(GUEST.name);
	await create.click();

	// The temporary password is shown once
	const shown = page.locator('section').filter({ hasText: 'Temporary password' }).locator('code');
	await expect(shown).toHaveText(/^[A-Za-z0-9]{16}$/);
	const temporary = (await shown.textContent())!;
	await expect(accounts.getByRole('listitem')).toHaveCount(2);
	await expect(accounts.getByText('0 titles · Temporary password')).toBeVisible();

	// The new user, in a browser of their own
	const theirs = await browser.newContext();
	const guest = await theirs.newPage();
	await loginAs(guest, GUEST.name, temporary);
	await expect(guest).toHaveURL('/new-password');
	await expect(guest.getByRole('heading', { name: 'Choose your own password' })).toBeVisible();
	// Nothing else can be opened until then
	await guest.goto('/movies');
	await expect(guest).toHaveURL('/new-password');
	await guest.locator('input[name=password]').fill(GUEST.password);
	await guest.locator('input[name=confirm]').fill('something else');
	await guest.getByRole('button', { name: 'Save password' }).click();
	await expect(guest.getByText('Passwords do not match')).toBeVisible();
	await guest.locator('input[name=password]').fill(GUEST.password);
	await guest.locator('input[name=confirm]').fill(GUEST.password);
	await guest.getByRole('button', { name: 'Save password' }).click();
	await expect(guest).toHaveURL('/');

	// An empty library of their own, whatever the admin tracks
	await expect(guest.getByText('Nothing on yet')).toBeVisible();
	await page.goto('/movies');
	await expect(page.getByRole('heading', { name: 'Movies' })).toBeVisible();
	const adminsMovies = await posters(page).count();
	await guest.goto('/movies');
	await expect(posters(guest)).toHaveCount(0);
	await addTitle(guest, 'movies', 'Test Movie Alpha', 'Planned');
	await guest.goto('/movies');
	await expect(posters(guest)).toHaveCount(1);

	// No administration: not in the menu, not by address, not by sending its forms
	await guest.goto('/settings');
	await expect(guest.getByRole('link', { name: /General/ })).toBeVisible();
	await expect(guest.getByRole('link', { name: /Users/ })).toHaveCount(0);
	await expect(guest.getByRole('link', { name: /Maintenance/ })).toHaveCount(0);
	expect((await guest.goto('/settings/users'))?.status()).toBe(403);
	expect((await guest.goto('/settings/server'))?.status()).toBe(403);
	const forged = await theirs.request.post('/settings/users?/create', {
		headers: { Origin: new URL(guest.url()).origin },
		form: { username: 'sneaky' }
	});
	expect(forged.status()).toBe(403);

	// Webhook and ntfy are for admins unless allowed
	await guest.goto('/settings/notifications');
	await guest.getByRole('button', { name: 'Add a target' }).click();
	await expect(guest.getByRole('button', { name: /Pushover/ })).toBeVisible();
	await expect(guest.getByRole('button', { name: /Webhook/ })).toHaveCount(0);
	await expect(guest.getByRole('button', { name: /ntfy/ })).toHaveCount(0);

	// The admin sees how many titles, not which; their own library is untouched
	await page.goto('/settings/users');
	await expect(accounts.getByText(/1 title · last login/)).toBeVisible();
	await page.goto('/movies');
	await expect(posters(page)).toHaveCount(adminsMovies);

	// The guest chooses how the others see them: a name and a picture
	await guest.goto('/settings/account');
	const profile = guest
		.locator('section')
		.filter({ has: guest.getByRole('heading', { name: 'Profile' }) });
	await expect(profile.locator('img')).toHaveCount(0); // the letter on a colour
	await profile.getByLabel('Display name').fill('tester'); // the admin's name
	await profile.getByRole('button', { name: 'Save' }).click();
	await expect(profile.getByText('Somebody is already shown under this name.')).toBeVisible();
	await profile.getByLabel('Display name').fill('Guest of Honour');
	await saved(guest, 'profile', () => profile.getByRole('button', { name: 'Save' }).click());
	const uploaded = guest.waitForResponse((res) => res.url().includes('?/avatar'));
	await profile.locator('input[type=file]').setInputFiles({
		name: 'me.png',
		mimeType: 'image/png',
		buffer: PICTURE
	});
	expect((await uploaded).ok()).toBe(true);
	await expect(profile.locator('img')).toHaveAttribute('src', /^\/avatar\/\d+\?v=\d+$/);
	// The menu at the top right shows both at once: the name others see, and the login name
	await guest.getByRole('button', { name: 'Account menu' }).click();
	const me = guest.getByRole('menuitem', { name: /Guest of Honour/ });
	await expect(me).toContainText('@guest');
	await expect(me.locator('img')).toBeVisible();
	await guest.keyboard.press('Escape');
	expect(
		(await guest.request.get((await profile.locator('img').getAttribute('src')) ?? '')).headers()[
			'content-type'
		]
	).toBe('image/jpeg');
	// Something that is no picture is refused
	await profile.locator('input[type=file]').setInputFiles({
		name: 'notes.txt',
		mimeType: 'text/plain',
		buffer: Buffer.from('not a picture')
	});
	await expect(profile.getByText(/could not be read as a picture/)).toBeVisible();

	// The admin sees the new name and picture – and still the name they log in with
	await page.goto('/settings/users');
	await expect(accounts.getByText('Guest of Honour')).toBeVisible();
	await expect(accounts.getByText(/@guest · 1 title/)).toBeVisible();
	await expect(accounts.locator('img')).toHaveCount(1);

	// Locking throws the user out and keeps them out
	await page.goto('/settings/users');
	await accounts.getByRole('button', { name: /guest/ }).click();
	const row = accounts.getByRole('listitem').filter({ hasText: 'guest' });
	await saved(page, 'lock', () => row.locator('form[action="?/lock"] label').last().click());
	await guest.goto('/movies');
	await expect(guest).toHaveURL('/login');
	await loginAs(guest, GUEST.name, GUEST.password);
	await expect(guest.getByText('This account is locked.')).toBeVisible();
	await saved(page, 'lock', () => row.locator('form[action="?/lock"] label').last().click());
	await loginAs(guest, GUEST.name, GUEST.password);
	await expect(guest).toHaveURL('/');

	// The last admin cannot give up the role
	await accounts.getByRole('button', { name: /tester/ }).click();
	const mine = accounts.getByRole('listitem').filter({ hasText: 'tester' });
	await mine.locator('form[action="?/role"] label').last().click();
	await expect(mine.getByText('At least one admin who can log in has to remain.')).toBeVisible();
	await expect(mine.getByRole('button', { name: 'Delete account' })).toHaveCount(0);

	// Deleting asks for the name; the account and its library are gone
	await page.reload();
	await accounts.getByRole('button', { name: /guest/ }).click();
	await row.getByRole('button', { name: 'Delete account' }).click();
	const confirm = row.getByRole('button', { name: 'Delete for good' });
	await expect(confirm).toBeDisabled();
	await row.getByLabel(/to confirm/).fill('wrong');
	await confirm.click();
	await expect(accounts.getByText('Please type exactly “guest”.')).toBeVisible();
	await row.getByLabel(/to confirm/).fill(GUEST.name);
	await confirm.click();
	await expect(accounts.getByRole('listitem')).toHaveCount(1);
	await guest.goto('/movies');
	await expect(guest).toHaveURL('/login');
	await theirs.close();
});
