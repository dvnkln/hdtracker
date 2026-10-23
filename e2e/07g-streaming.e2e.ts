import { expect, test } from '@playwright/test';
import { loginOk, sheet } from './helpers';

// The streaming overview: what one wants to watch, by service. Test Movie Alpha streams at
// Netflix and can be rented at Amazon Video and Videoload, Future Film Beta streams at Prime Video
// (fixtures); changing a status in the window of the overview takes the title off there.
test('streaming overview: tiles by service, status changed in place', async ({ page }) => {
	await loginOk(page);
	// Alpha planned for the time of this test
	await page.goto('/movies');
	const alpha = page.getByRole('button', { name: /Test Movie Alpha/ });
	await alpha.click();
	const before = await sheet(page).locator('button[name=status][aria-pressed=true]').textContent();
	await sheet(page).getByRole('button', { name: 'Planned', exact: true }).click();
	await expect(sheet(page)).toHaveCount(0);

	// The icon in the header leads to the tiles
	await page.getByRole('link', { name: 'What runs where' }).click();
	await expect(page).toHaveURL('/streaming');
	await expect(page.getByRole('heading', { name: 'Streaming', level: 1 })).toBeVisible();
	const netflix = page.getByRole('link', { name: /Netflix/ });
	await expect(netflix).toContainText('1');

	// The order of the tiles: A–Z at first, a tap switches to most titles first – remembered
	const order = page.getByRole('button', { name: /change the order/ });
	await expect(order).toHaveAccessibleName('A–Z – change the order');
	await order.click();
	await expect(order).toHaveAccessibleName('Most titles first – change the order');
	await page.reload();
	await expect(order).toHaveAccessibleName('Most titles first – change the order');
	await order.click();
	await expect(order).toHaveAccessibleName('A–Z – change the order');
	await page.reload();
	await expect(order).toHaveAccessibleName('A–Z – change the order');

	// Hiding a service: "edit", a tap on the tile, "done" – it waits small at the end, also after
	// a reload, and comes back the same way
	await page.getByRole('button', { name: 'Show or hide services' }).click();
	await page.getByRole('button', { name: 'Hide Netflix' }).click();
	await page.getByRole('button', { name: 'Done' }).click();
	await expect(netflix).toHaveCount(0);
	await page.reload();
	await expect(page.getByText('1 hidden')).toBeVisible();
	await expect(netflix).toBeHidden();
	await page.getByRole('button', { name: 'Show or hide services' }).click();
	await page.getByRole('button', { name: 'Show Netflix' }).click();
	await page.getByRole('button', { name: 'Done' }).click();
	await page.reload();
	await expect(netflix).toBeVisible();
	await expect(page.getByText('1 hidden')).toHaveCount(0);

	// One tile per service, as TMDB lists them: "Netflix Kids" is Netflix, the channel without
	// its service ("ARD Plus Amazon channel ") is left out; Amazon Video counts for Prime Video,
	// Videoload only sells – a tile of its own with the bag
	await expect(page.getByRole('link', { name: /Netflix Kids|ARD Plus|Amazon Video/ })).toHaveCount(
		0
	);
	await expect(page.getByRole('link', { name: /Videoload/ })).toBeVisible();
	const prime = page.getByRole('link', { name: /Amazon Prime Video/ });
	await expect(prime).toBeVisible();

	// Prime Video: Beta in the subscription, Alpha to rent – one tab each next to "Movies"
	await prime.click();
	const beta = page.getByRole('button', { name: /Future Film Beta/ });
	const subscription = page.getByRole('tab', { name: /Subscription/ });
	const rentBuy = page.getByRole('tab', { name: /Rent\/Buy/ });
	await expect(subscription).toHaveAttribute('aria-selected', 'true');
	await expect(beta).toBeVisible();
	await expect(alpha).toHaveCount(0);
	await rentBuy.click();
	await expect(page).toHaveURL(/buy=movies/);
	await expect(alpha).toBeVisible();
	await expect(beta).toHaveCount(0);
	// Coming back opens the same tab; the tabs stay reachable by keyboard
	await page.reload();
	await expect(rentBuy).toHaveAttribute('aria-selected', 'true');
	await expect(rentBuy).toBeEnabled();
	await page.goto('/streaming');

	// A tile shows the posters of that service, by area; the way back leads to the tiles
	await netflix.click();
	await expect(page).toHaveURL('/streaming?s=Netflix');
	await expect(page.getByRole('heading', { name: 'Netflix', level: 1 })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Movies', level: 2 })).toBeVisible();
	// Only one area here: nothing to fold, so no arrow, and a tap on the heading leaves it open
	const area = page.locator('details[data-sticky]');
	await expect(area).toHaveCount(1);
	await expect(area.locator('summary svg.lucide-chevron-right')).toHaveCount(0);
	// Netflix has nothing to rent: only its one tab
	await expect(page.getByRole('tab')).toHaveText([/Subscription/]);
	await area.locator('summary h2').click();
	await expect(area).toHaveAttribute('open');
	await page.goBack();
	await expect(page.getByRole('heading', { name: 'Streaming', level: 1 })).toBeVisible();
	await netflix.click();

	// Watched in the window of the overview: saved, the title leaves the service – and with it
	// gone, the page is back at the tiles (without the old address)
	await page.getByRole('button', { name: /Test Movie Alpha/ }).click();
	await sheet(page).getByRole('button', { name: 'Watched', exact: true }).click();
	await expect(sheet(page)).toHaveCount(0);
	await expect(page).toHaveURL('/streaming');
	await expect(page.getByRole('heading', { name: 'Streaming', level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: /Netflix/ })).toHaveCount(0);

	// Alpha back to what it was
	await page.goto('/movies');
	// (watched titles are folded away: unfold them like a user, once the page is ready for it)
	await expect(async () => {
		if (!(await alpha.isVisible())) await page.getByRole('heading', { name: 'Watched' }).click();
		await expect(alpha).toBeVisible({ timeout: 1000 });
	}).toPass();
	await alpha.click();
	await sheet(page).getByRole('button', { name: before!.trim(), exact: true }).click();
	await expect(sheet(page)).toHaveCount(0);
});
