import { test, expect } from '@playwright/test';

test('enlarged text keeps home within viewport', async ({ page }, info) => {
	test.skip(info.project.name === 'desktop', 'Mobile viewport stress');
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/home');
	await page.evaluate(() => {
		document.documentElement.style.fontSize = '20px';
	});
	await expect(page.getByRole('heading', { name: 'Вступай в игру' })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
	await expect(page.getByRole('link', { name: /Steam/i }).first()).toBeVisible();
});

test('offline shell page is branded and usable', async ({ page }) => {
	await page.goto('/offline.html');
	await expect(page.getByRole('heading', { name: 'Нет соединения' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Повторить' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'На главную' })).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
