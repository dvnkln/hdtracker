import { expect, test, type Page } from '@playwright/test';
import { loginOk, sheet } from './helpers';

// A second account, created by the admin in this test and removed again at its end.
const MATE = { name: 'mate', password: 'mate-password-6789' };
const SERIES = '/series/201'; // in the admin's library: "Watched", 4 of 4 episodes

// Changes the status of the open title through its window.
async function setStatus(page: Page, from: string, to: string) {
	await page.getByRole('button', { name: from, exact: true }).click();
	await sheet(page).getByRole('button', { name: to, exact: true }).click();
	await expect(sheet(page)).toHaveCount(0);
	await expect(page.getByRole('button', { name: to, exact: true })).toBeVisible();
}

test('tracking together: invite, accept, one state for both, leave with a copy', async ({
	page,
	browser
}) => {
	// The admin creates the account; its owner chooses a password
	await loginOk(page);
	await page.goto('/settings/users');
	const accounts = page
		.locator('section')
		.filter({ has: page.getByRole('heading', { name: 'Accounts' }) });
	await accounts.getByRole('button', { name: 'Add a user' }).click();
	await accounts.getByLabel('Username').fill(MATE.name);
	await accounts.getByRole('button', { name: 'Create' }).click();
	const temporary = (await page
		.locator('section')
		.filter({ hasText: 'Temporary password' })
		.locator('code')
		.textContent())!;
	const theirs = await browser.newContext();
	const mate = await theirs.newPage();
	await mate.goto('/login');
	await mate.locator('input[name=username]').fill(MATE.name);
	await mate.locator('input[name=password]').fill(temporary);
	await mate.getByRole('button', { name: 'Log in' }).click();
	await mate.locator('input[name=password]').fill(MATE.password);
	await mate.locator('input[name=confirm]').fill(MATE.password);
	await mate.getByRole('button', { name: 'Save password' }).click();
	await expect(mate).toHaveURL('/');

	// The symbol next to the status invites; the window lists who can be asked
	await page.goto(SERIES);
	await page.getByRole('button', { name: 'Track together – invite somebody' }).click();
	await sheet(page).getByRole('button', { name: 'Invite mate' }).click();
	await expect(sheet(page).getByText('Invited – no answer yet')).toBeVisible();
	// Taking it back and asking again
	await sheet(page).getByRole('button', { name: 'Withdraw the invitation for mate' }).click();
	await sheet(page).getByRole('button', { name: 'Invite mate' }).click();
	await expect(sheet(page).getByText('Invited – no answer yet')).toBeVisible();
	await sheet(page).getByRole('button', { name: 'Close' }).click();
	await expect(
		page.getByRole('button', { name: 'Track together – invitation not answered yet' })
	).toBeVisible();

	// The invited one sees a number at the bell in the header; it leads to the invitation
	await mate.goto('/');
	await mate.getByRole('link', { name: 'Inbox – 1 new' }).click();
	await expect(mate).toHaveURL('/inbox');
	await expect(mate.getByRole('heading', { name: 'Invitations for you' })).toBeVisible();
	await expect(mate.getByText('tester invites you · Watched')).toBeVisible();
	// ... with a trailer to look at before answering
	await expect(mate.getByRole('link', { name: 'Trailer' })).toHaveAttribute(
		'href',
		'https://www.youtube.com/watch?v=trailGamma1'
	);
	// The one who asked sees it waiting, and could take it back there
	await page.goto('/inbox');
	await expect(page.getByRole('heading', { name: 'Waiting for an answer' })).toBeVisible();
	await expect(page.getByText('Invited: mate')).toBeVisible();
	await expect(
		page.getByRole('button', { name: 'Withdraw the invitation for mate' })
	).toBeVisible();

	// It is also on the page of the title, with the state they would take over
	await mate.getByRole('link', { name: /Test Series Gamma/ }).click();
	await expect(mate).toHaveURL(SERIES);
	await expect(mate.getByText('tester invites you to track this together')).toBeVisible();
	await expect(mate.getByText('Their status: Watched')).toBeVisible();
	await expect(mate.getByRole('link', { name: 'Trailer' })).toHaveCount(1); // not a second one in the card
	await expect(mate.getByRole('button', { name: 'Add to library' })).toBeVisible();
	await mate.getByRole('button', { name: 'Accept' }).click();
	await expect(mate.getByText('tester invites you')).toHaveCount(0);
	await expect(mate.getByRole('button', { name: 'Watched', exact: true })).toBeVisible();
	await expect(mate.getByText('4 / 4 episodes watched')).toBeVisible();
	await expect(mate.getByRole('button', { name: 'Tracking together with tester' })).toBeVisible();

	// Answered: the number at the bell is gone, the inbox is empty again
	await mate.getByRole('link', { name: 'Inbox', exact: true }).click();
	await expect(mate.getByRole('heading', { name: 'Nothing new' })).toBeVisible();
	await mate.goto(SERIES);
	// Who asked finds the answer in their inbox – unread until they have seen it there
	await page.goto('/inbox');
	const answer = page.getByRole('link', { name: /mate accepted your invitation/ });
	await expect(answer).toContainText('Test Series Gamma');
	await expect(answer.getByText('new', { exact: true })).toBeAttached();
	await expect(page.getByRole('heading', { name: 'Waiting for an answer' })).toHaveCount(0);
	await page.goto(SERIES);
	await page.goto('/inbox');
	await expect(answer).toBeVisible();
	await expect(answer.getByText('new', { exact: true })).toHaveCount(0);

	// One state for both: what one changes, the other sees
	await setStatus(mate, 'Watched', 'Paused');
	await page.goto(SERIES);
	await expect(page.getByRole('button', { name: 'Paused', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Tracking together with mate' }).click();
	await expect(sheet(page).getByText('mate')).toBeVisible();

	await sheet(page).getByRole('button', { name: 'Close' }).click();
	// In the library and on the dashboard the poster carries the picture of who tracks along
	await page.goto('/series');
	const poster = page.getByRole('button', { name: /Test Series Gamma/ });
	await expect(poster.getByTitle('mate')).toBeVisible();
	await page.goto(SERIES);
	await page.getByRole('button', { name: 'Tracking together with mate' }).click();

	// Leaving keeps a copy; from then on each has their own
	await sheet(page).getByRole('button', { name: 'Stop tracking together' }).click();
	await sheet(page).getByRole('button', { name: 'Track on my own' }).click();
	await expect(sheet(page).getByRole('button', { name: 'Invite mate' })).toBeVisible();
	await sheet(page).getByRole('button', { name: 'Close' }).click();
	await expect(page.getByRole('button', { name: 'Paused', exact: true })).toBeVisible();
	await expect(page.getByText('4 / 4 episodes watched')).toBeVisible();
	await mate.reload();
	await setStatus(mate, 'Paused', 'Dropped');
	await page.reload();
	await expect(page.getByRole('button', { name: 'Paused', exact: true })).toBeVisible();

	// The window that changes the status also holds the bell and tracking together
	await page.goto('/series');
	await page.getByRole('button', { name: /Test Series Gamma/ }).click();
	const bell = sheet(page).getByRole('button', { name: 'Notifications about this title' });
	await expect(bell).toHaveAttribute('aria-pressed', 'true');
	await bell.click();
	await expect(bell).toHaveAttribute('aria-pressed', 'false');
	await bell.click();
	await expect(bell).toHaveAttribute('aria-pressed', 'true');
	await sheet(page).getByRole('button', { name: 'Track together – invite somebody' }).click();
	const who = page.locator('dialog[open]').last();
	await who.getByRole('button', { name: 'Invite mate' }).click();
	await expect(who.getByText('Invited – no answer yet')).toBeVisible();
	await who.getByRole('button', { name: 'Withdraw the invitation for mate' }).click();
	await expect(who.getByRole('button', { name: 'Invite mate' })).toBeVisible();
	await who.getByRole('button', { name: 'Close' }).click();
	await sheet(page).getByRole('button', { name: 'Close' }).click();

	// Several titles at once: a right click (holding, on a phone) starts selecting, Ctrl+click
	// too; taps add and take away, and with nothing left selected it is over
	await page.goto('/movies');
	const posters = page.locator('main [class*="group/poster"]');
	const invite = page.getByRole('button', { name: 'Invite …' });
	await posters.first().click({ button: 'right' });
	await expect(page.getByText('1 title selected').first()).toBeVisible();
	await expect(sheet(page)).toHaveCount(0); // no status window while selecting
	await posters.first().click();
	await expect(invite).toHaveCount(0);
	await posters.first().click({ modifiers: ['Control'] });
	await expect(page.getByText('1 title selected').first()).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(invite).toHaveCount(0);
	// ... then choose whom to invite
	await posters.first().click({ button: 'right' });
	await invite.click();
	await sheet(page).getByRole('button', { name: 'Invite mate' }).click();
	// Said in passing: a small message above the navigation that goes away by itself
	const said = page.getByRole('status').getByText('1 invitation sent to mate.');
	await expect(said).toBeVisible();
	await expect(said).toHaveCount(0, { timeout: 8000 });
	await expect(invite).toHaveCount(0); // selecting is over
	await mate.goto('/inbox');
	await expect(mate.getByRole('heading', { name: 'Invitations for you' })).toBeVisible();

	// Back to how it was: the status, and one account
	await page.goto(SERIES);
	await setStatus(page, 'Paused', 'Watched');
	await page.goto('/settings/users');
	await accounts.getByRole('button', { name: /mate/ }).click();
	const row = accounts.getByRole('listitem').filter({ hasText: 'mate' });
	await row.getByRole('button', { name: 'Delete account' }).click();
	await row.getByLabel(/to confirm/).fill(MATE.name);
	await row.getByRole('button', { name: 'Delete for good' }).click();
	await expect(accounts.getByRole('listitem')).toHaveCount(1);
	await theirs.close();

	// With nobody to share with, the symbol on the page of a title is gone; what the deleted
	// account did is no longer in the inbox
	await page.goto('/inbox');
	await expect(page.getByText(/mate/)).toHaveCount(0);
	await page.goto(SERIES);
	await expect(page.getByRole('button', { name: 'Watched', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: /Track together/ })).toHaveCount(0);
});
