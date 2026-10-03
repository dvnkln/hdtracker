import { expect, test } from '@playwright/test';
import { loginOk } from './helpers';

test('export, clear the library, import: the library is the same again', async ({ page }) => {
	await loginOk(page);

	// What is in the library so far (from the tests before): status per title
	const csv = await (await page.request.get('/settings/data/export')).text();
	expect(csv).toContain('Test Series Gamma');
	expect(csv).toContain('Future Film Beta');
	const rows = csv.trim().split('\n').length - 1;
	expect(rows).toBeGreaterThan(5); // titles plus seasons and episodes of the series

	await page.goto('/settings/data');
	await page.locator('select[name=target]').selectOption('all');
	const clear = page.getByRole('button', { name: /Clear|Delete/ }).last();
	await expect(clear).toBeDisabled();
	await page.locator('input[name=confirm]').fill('DELETE');
	await clear.click();
	await page.goto('/series');
	await expect(page.getByText('Your library is still empty')).toBeVisible();

	await page.goto('/settings/data');
	const start = page.getByRole('button', { name: /Import/ }).first();
	await expect(start).toBeDisabled(); // no file chosen yet
	await page
		.locator('input[type=file]')
		.setInputFiles({ name: 'export.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
	await start.click();
	await expect(page.getByText(/imported/i).first()).toBeVisible();

	// Same export as before (apart from the time stamps of the import)
	const again = await (await page.request.get('/settings/data/export')).text();
	const shape = (text: string) =>
		text
			.trim()
			.split('\n')
			.slice(1)
			.map((line) => line.split('","').slice(0, 9).join('|'))
			.sort();
	expect(shape(again)).toEqual(shape(csv));

	await page.goto('/series/201');
	await expect(page.getByText('4 / 4 episodes watched')).toBeVisible();
});
