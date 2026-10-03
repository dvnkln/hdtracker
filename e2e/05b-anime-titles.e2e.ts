import { expect, test, type Page } from '@playwright/test';
import { loginOk } from './helpers';

// The anime added in 05-dashboard comes from AniList, which has no episode titles. They are
// taken from the show a community list maps it to at TMDB (see fixtures.mjs).
const ANIME = '/anime/301';

// Switch "Episode titles for anime" under Settings → Server
async function setEpisodeTitles(page: Page, on: boolean) {
	await page.goto('/settings/server');
	const content = page.locator('form[action="?/content"]');
	const box = content.locator('input[name=animeEpisodeTitles]');
	await expect(box).toBeChecked({ checked: !on });
	// (the switch is a hidden checkbox: it is operated through its label)
	await content.locator('label[for=animeEpisodeTitles]').click();
	await content.getByRole('button', { name: 'Save' }).click();
	await expect(content.getByText('Saved')).toBeVisible();
}

test('anime: episode titles and description from TMDB, can be switched off', async ({ page }) => {
	await loginOk(page);
	await page.goto(ANIME);
	// Title stays the one of AniList, the texts are those of TMDB
	await expect(page.getByRole('heading', { name: 'Test Anime Delta' })).toBeVisible();
	await expect(page.getByText('The season as TMDB describes it.')).toBeVisible();
	const first = page.getByRole('button', { name: /Delta sets out/ });
	await expect(first).toBeVisible();
	// Episode 3 has a title already, but has not aired
	await expect(page.getByRole('button', { name: /Things to come/ })).toBeDisabled();

	// Ticking an episode works as in the list of a series
	await first.click();
	await expect(first).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByText('1 / 2')).toBeVisible();
	await first.click();
	await expect(first).toHaveAttribute('aria-pressed', 'false');

	// Switched off: back to the numbers and the description of AniList. The anime is loaded
	// again in the background, so look until it is there.
	await setEpisodeTitles(page, false);
	await expect(async () => {
		await page.goto(ANIME);
		await expect(page.getByText('A made-up anime.')).toBeVisible({ timeout: 1000 });
	}).toPass();
	await expect(page.getByRole('button', { name: /Delta sets out/ })).toHaveCount(0);
	await expect(page.getByRole('button', { name: '1', exact: true })).toBeVisible();

	// ... and on again for whatever follows
	await setEpisodeTitles(page, true);
	await expect(async () => {
		await page.goto(ANIME);
		await expect(page.getByRole('button', { name: /Delta sets out/ })).toBeVisible({
			timeout: 1000
		});
	}).toPass();
});
