import { expect, test } from '@playwright/test';
import { loginOk, sheet } from './helpers';

// The header and the navigation at the bottom stay on top of the page at every scroll position.
// The sticking headings of the library have a level of their own; once one lay over the
// navigation and covered its labels (0.10.3) – nothing had checked what is on top where they meet.
test('header and navigation are never covered by the page, at any scroll position', async ({
	page
}) => {
	// A short phone, so the headings of the library meet both bars while scrolling
	await page.setViewportSize({ width: 412, height: 380 });
	await loginOk(page);
	await page.goto('/movies');
	const alpha = page.getByRole('button', { name: /Test Movie Alpha/ });
	await expect(alpha).toBeVisible();
	// Two sections, so a heading comes up from below and meets the navigation: Alpha watched
	// for the time of this test (Beta is not out yet and stays planned)
	await alpha.click();
	const before = await sheet(page).locator('button[name=status][aria-pressed=true]').textContent();
	await sheet(page).getByRole('button', { name: 'Watched', exact: true }).click();
	await expect(sheet(page)).toHaveCount(0);
	await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));

	const end = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
	let metNav = 0;
	for (let y = 0; y <= end + 8; y += 8) {
		await page.evaluate((y) => scrollTo(0, y), y);
		const found = await page.evaluate(() => {
			const bars = [...document.querySelectorAll('[data-chrome=header], [data-chrome=nav]')];
			const headings = [...document.querySelectorAll('main summary')].map((s) =>
				s.getBoundingClientRect()
			);
			let meetsNav = false;
			const covered: string[] = [];
			for (const bar of bars) {
				const box = bar.getBoundingClientRect();
				const meets = headings.some((h) => h.bottom > box.top && h.top < box.bottom);
				if (meets && bar.getAttribute('data-chrome') === 'nav') meetsNav = true;
				// Points across the bar, a little inside its edges
				for (const fx of [0.1, 0.3, 0.5, 0.7, 0.9]) {
					for (const fy of [0.25, 0.5, 0.75]) {
						const x = box.left + box.width * fx;
						const y = box.top + box.height * fy;
						const top = document.elementFromPoint(x, y);
						if (top && !bar.contains(top)) covered.push(`${bar.getAttribute('data-chrome')}`);
					}
				}
			}
			return { meetsNav, covered };
		});
		if (found.meetsNav) metNav++;
		expect(found.covered, `scrolled to ${y}`).toEqual([]);
	}
	// The check only means something if a heading actually came under the navigation
	expect(metNav).toBeGreaterThan(0);

	// Alpha back to what it was
	await page.evaluate(() => scrollTo(0, 0));
	await alpha.click();
	await sheet(page).getByRole('button', { name: before!.trim(), exact: true }).click();
	await expect(sheet(page)).toHaveCount(0);
});
