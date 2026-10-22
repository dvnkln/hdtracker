import { expect, test } from '@playwright/test';
import { addTitle, loginOk } from './helpers';

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

test('games: the stores on the detail page, and filters by store and platform', async ({
	page
}) => {
	await loginOk(page);
	await addTitle(page, 'games', 'Test Game Epsilon', 'Playing');
	await addTitle(page, 'games', 'Test Game Zeta', 'Planned');

	// The detail page links each store; PlayStation leads to the store of one's own country
	await page.goto('/games/402');
	await expect(page.getByRole('heading', { name: 'Available at' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'PlayStation Store' })).toHaveAttribute(
		'href',
		'https://store.playstation.com/concept/402'
	);
	await page.goto('/games/401');
	await expect(page.getByRole('link', { name: 'Steam' })).toHaveAttribute(
		'href',
		'https://store.steampowered.com/app/401'
	);
	await expect(page.getByRole('link', { name: 'Nintendo eShop' })).toBeVisible();
	await expect(page.getByText('Windows, Nintendo Switch')).toBeVisible();

	// The search in the header stays at games while one is in that area – even when another
	// area was the last one chosen, and after a look at a title and back
	await page.evaluate(() => localStorage.setItem('hdtracker.searchCategory', 'movies'));
	await page.goto('/games');
	const search = page.getByPlaceholder('Search games…').filter({ visible: true });
	await expect(search).toBeVisible();
	for (let round = 0; round < 2; round++) {
		await page.getByRole('button', { name: /Test Game Zeta/ }).click();
		await page.locator('dialog[open]').getByRole('link', { name: 'Details' }).click();
		await expect(page).toHaveURL('/games/402');
		await expect(search).toBeVisible();
		await page.goBack();
		await expect(page).toHaveURL('/games');
		await expect(search).toBeVisible();
	}

	// The filter offers stores and platforms once the details of both games are stored
	await page.goto('/games');
	const epsilon = page.getByRole('button', { name: /Test Game Epsilon/ });
	const zeta = page.getByRole('button', { name: /Test Game Zeta/ });
	const funnel = page.getByRole('button', { name: 'Filter', exact: true });
	const window = page.locator('dialog[open]');
	await expect(async () => {
		await page.reload();
		await funnel.click({ timeout: 1000 });
		await expect(window.getByRole('checkbox', { name: 'Steam' })).toBeVisible({ timeout: 1000 });
		await expect(window.getByRole('checkbox', { name: 'PlayStation Store' })).toBeVisible({
			timeout: 1000
		});
	}).toPass();

	// A store: only the game it sells stays
	await window.getByRole('checkbox', { name: 'Steam' }).click();
	await window.getByRole('button', { name: 'Show 1 title' }).click();
	await expect(epsilon).toBeVisible();
	await expect(zeta).toHaveCount(0);
	await expect(page).toHaveURL(/f=store(%3A|:)steam/);

	// Another store is "or"; a platform on top is "and"
	await funnel.click();
	await window.getByRole('checkbox', { name: 'PlayStation Store' }).click();
	await expect(window.getByRole('button', { name: 'Show 2 titles' })).toBeVisible();
	await window.getByRole('checkbox', { name: /^PlayStation 5/ }).click();
	await window.getByRole('button', { name: 'Show 1 title' }).click();
	await expect(zeta).toBeVisible();
	await expect(epsilon).toHaveCount(0);
	await page.getByRole('button', { name: 'Clear all filters' }).click();
	await expect(epsilon).toBeVisible();
});
