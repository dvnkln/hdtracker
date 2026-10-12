import { expect, test } from '@playwright/test';
import { loginOk } from './helpers';

test('on a computer the scrollbar floats: header and navigation reach the edge, a handle shows the place and can be dragged', async ({
	page
}) => {
	await page.setViewportSize({ width: 1280, height: 500 });
	await loginOk(page);
	await page.goto('/settings/about');
	const width = () => page.evaluate(() => window.innerWidth);
	const y = () => page.evaluate(() => window.scrollY);

	// Nothing is reserved for a scrollbar: the bars are as wide as the window
	expect(await page.evaluate(() => document.documentElement.clientWidth)).toBe(await width());
	expect((await page.locator('header').boundingBox())?.width).toBe(await width());
	expect((await page.locator('nav').last().boundingBox())?.width).toBe(await width());

	// A long page: the handle appears when scrolling and follows
	const thumb = page.locator('[data-scroll-thumb]');
	await expect(thumb).toHaveCSS('opacity', '0');
	await page.mouse.move(600, 300);
	await page.mouse.wheel(0, 200);
	await expect.poll(y).toBeGreaterThan(100);
	await expect(thumb).not.toHaveCSS('opacity', '0');
	const before = (await thumb.boundingBox())!;

	// It runs between the fixed bars, never over them
	const header = (await page.locator('header').boundingBox())!;
	const nav = (await page.locator('nav').last().boundingBox())!;
	expect(before.y).toBeGreaterThan(header.y + header.height);
	await page.evaluate(() => window.scrollTo(0, 0));
	await expect.poll(async () => (await thumb.boundingBox())!.y).toBe(header.y + header.height);
	await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
	await expect
		.poll(async () => {
			const box = (await thumb.boundingBox())!;
			return Math.round(box.y + box.height);
		})
		.toBe(Math.round(nav.y));
	await page.evaluate(() => window.scrollTo(0, 200));
	await expect.poll(y).toBe(200);

	// Dragging it scrolls the page
	const at = await y();
	const now = (await thumb.boundingBox())!;
	await page.mouse.move(now.x + now.width / 2, now.y + now.height / 2);
	await page.mouse.down();
	await page.mouse.move(now.x + now.width / 2, now.y + now.height / 2 + 80, {
		steps: 4
	});
	await page.mouse.up();
	await expect.poll(y).toBeGreaterThan(at + 50);

	// A page that fits has no handle
	await page.setViewportSize({ width: 1280, height: 3000 });
	await page.goto('/settings/appearance');
	await expect(thumb).toHaveCount(0);
});
