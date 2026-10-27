import { expect, test } from '@playwright/test';
import { loginOk, sheet } from './helpers';

// The anime search shows entries that belong together as one series (see "Test Saga" in
// fixtures.mjs): one poster, a list of its parts in order, the status window for each part.
test('anime search: a series is one poster with its parts', async ({ page }) => {
	await loginOk(page);
	await page.goto('/anime?q=Test%20Saga');

	// Three hits, one poster (counted as one)
	await expect(page.getByText('1 result for')).toBeVisible();
	const poster = page.getByRole('button', { name: /^Test Saga/ });
	await expect(poster).toHaveCount(1);
	// Nothing tracked yet: season 1, and what is in the series
	await expect(poster).toContainText('2 seasons · 1 movie');
	await expect(poster.locator('img')).toHaveAttribute('src', /saga311/);

	// Its parts: the seasons in order of airing (AniList lists season 2 first), then the movie
	await poster.click();
	const parts = page.locator('dialog[open]');
	await expect(parts.getByRole('heading', { name: 'Test Saga', exact: true })).toBeVisible();
	const rows = parts.getByRole('listitem');
	await expect(rows).toHaveCount(3);
	await expect(rows.nth(0)).toContainText('1. Test Saga');
	await expect(rows.nth(0)).toContainText('Fall 2019 · TV · 12 episodes');
	await expect(rows.nth(1)).toContainText('2. Test Saga Season 2');
	await expect(rows.nth(2)).toContainText('Test Saga: The Movie');
	await expect(rows.nth(2)).toContainText('2022 · Movie');

	// A part opens the status window on top; after choosing, the list shows the status
	await rows.nth(1).getByRole('button').click();
	const status = sheet(page).last();
	await expect(status.getByRole('heading', { name: 'Test Saga Season 2' })).toBeVisible();
	await expect(status.getByText('A made-up series.')).toBeVisible();
	await status.getByRole('button', { name: 'Watching', exact: true }).click();
	await expect(page.locator('dialog[open]')).toHaveCount(1);
	await expect(rows.nth(1)).toContainText('Watching');
	// Season 2 brings the series along: season 1 as watched (the movie does not come along) –
	// folded into one line, with the progress over the seasons on top, season 2 up next
	await expect(rows.nth(0)).toContainText('S1 watched');
	await expect(parts).toContainText('1 / 2 seasons watched');
	// (highlighted as the one the user is on – "up next" is only said of a planned one)
	await expect(rows.nth(1)).not.toContainText('Up next');
	await expect(rows.nth(2)).not.toContainText('Watched');
	await expect(parts).toContainText('2 parts in your library');

	// Closed again: the poster shows the part the user is on
	await parts.getByRole('button', { name: 'Close' }).click();
	await expect(page.locator('dialog[open]')).toHaveCount(0);
	await expect(poster).toContainText('Watching');
	await expect(poster).toContainText('2021 · S2');
	await expect(poster.locator('img')).toHaveAttribute('src', /saga312/);

	// The movie watched as well (the window shows the same poster as the stack)
	await poster.click();
	await expect(parts.locator('img').first()).toHaveAttribute('src', /saga312/);
	await rows.nth(2).getByRole('button').click();
	await sheet(page).last().getByRole('button', { name: 'Watched', exact: true }).click();
	await expect(page.locator('dialog[open]')).toHaveCount(1);
	await parts.getByRole('button', { name: 'Close' }).click();

	// The library: the seasons as one stack where the user is (season 2), the movie on its own
	// with a label – once the details are loaded (they say what belongs together)
	await page.goto('/anime');
	const section = (name: string) =>
		page.locator('details').filter({ has: page.getByRole('heading', { name, exact: true }) });
	const stack = section('Watching').getByRole('button', { name: /^Test Saga/ });
	await expect(async () => {
		await page.reload();
		await expect(stack).toContainText('2021 · S2', { timeout: 1000 });
	}).toPass({ timeout: 20_000 });
	await expect(stack.locator('img')).toHaveAttribute('src', /saga312/);
	await section('Watched').locator('summary').click();
	const movie = section('Watched').getByRole('button', { name: /Test Saga: The Movie/ });
	await expect(movie).toContainText('Movie');
	// The stack lists its seasons (the watched one folded, it opens)
	await stack.click();
	await expect(rows).toHaveCount(2);
	await expect(rows.nth(0)).toContainText('S1 watched');
	await expect(rows.nth(1)).toContainText('Watching');
	await rows.nth(0).getByRole('button').click();
	await expect(rows).toHaveCount(3);
	await expect(rows.nth(1)).toContainText('Watched');

	// Only seasons in it: the bell for all seasons at the top – muting mutes both
	await parts.getByRole('button', { name: 'Mute all seasons' }).click();
	await expect(parts.getByRole('button', { name: 'Unmute all seasons' })).toBeVisible();
	await parts.getByRole('button', { name: 'Unmute all seasons' }).click();
	await expect(parts.getByRole('button', { name: 'Mute all seasons' })).toBeVisible();

	// Season 2 watched as well: everything of the series is watched now, so the stack moves to
	// "Watched" (with the movie) – and its window stays open
	await rows.nth(2).getByRole('button').click();
	await sheet(page).last().getByRole('button', { name: 'Watched', exact: true }).click();
	await expect(page.locator('dialog[open]')).toHaveCount(1);
	await expect(parts).toContainText('2 / 2 seasons watched');
	await expect(rows.last()).toContainText('Test Saga: The Movie');
	// With the movie in it, the bell stands at "Seasons" (it is for the seasons only)
	const seasonsRow = parts
		.locator('div')
		.filter({ has: page.getByRole('heading', { name: 'Seasons' }) });
	await expect(seasonsRow.getByRole('button', { name: 'Mute all seasons' })).toBeVisible();

	// Taking the seasons away (unfolded first) leaves the movie alone: no stack, the window closes
	const fold = parts.getByRole('button', { name: /watched$/ });
	for (let i = 0; i < 2; i++) {
		if ((await fold.getAttribute('aria-expanded')) !== 'true') await fold.click();
		await rows.nth(1).getByRole('button').click();
		await sheet(page).last().getByRole('button', { name: 'Remove from library' }).click();
		await sheet(page).last().getByRole('button', { name: 'Really remove from library?' }).click();
		if (i === 0) await expect(rows).toHaveCount(2);
	}
	await expect(page.locator('dialog[open]')).toHaveCount(0);

	// Tidy up for the tests after this one
	await movie.click();
	await sheet(page).getByRole('button', { name: 'Remove from library' }).click();
	await sheet(page).getByRole('button', { name: 'Really remove from library?' }).click();
	await expect(page.getByRole('button', { name: /Test Saga/ })).toHaveCount(0);
});
