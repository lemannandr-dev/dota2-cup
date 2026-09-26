import { test, expect } from '@playwright/test';

test('home artwork, layout and navigation', async ({ page, isMobile }, testInfo) => {
	test.setTimeout(180000);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/home');
	await expect(page.getByRole('heading', { name: 'Вступай в игру' })).toBeVisible();
	await expect.poll(() => page.locator('.arena-cover-art').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
	await expect(page.locator('.arena-cover-title')).toBeVisible();
	await expect(page.locator('.arena-visual-layer')).toHaveCSS('position', 'fixed');
	await expect(page.locator('.arena-visual-layer')).toHaveCSS('pointer-events', 'none');
	expect(await page.locator('.arena-cover').evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(isMobile ? 320 : 400);
	expect(await page.locator('.arena-cover-title').evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(24);
	await page.getByRole('link', { name: 'Войти через Steam', exact: true }).filter({ visible: true }).last().click({ trial: true });
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.screenshot({ path: testInfo.outputPath('home.png'), animations: 'disabled', scale: 'css' });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	expect(await page.locator('.arena-cover-art').evaluate((img) => getComputedStyle(img).animationDuration.split(',').every((time) => parseFloat(time) <= 0.01))).toBe(true);
	if (isMobile) {
		await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Кубки' }).click();
		await expect(page).toHaveURL(/\/tournaments$/);
		await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		await page.screenshot({ path: testInfo.outputPath('tournaments.png'), animations: 'disabled', scale: 'css' });
		await page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link', { name: 'Команды' }).click();
	} else {
		await page.goto('/teams');
	}
	await expect(page).toHaveURL(/\/teams$/);
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.screenshot({ path: testInfo.outputPath('teams.png'), animations: 'disabled', scale: 'css' });
	expect(errors).toEqual([]);
});

test('appearance endpoints reject visitors', async ({ request }) => {
	expect((await request.get('/api/admin/appearance')).status()).toBe(401);
	expect((await request.post('/api/admin/appearance/upload')).status()).toBe(401);
	expect((await request.get('/api/media/appearance/local/disputes/private.webp')).status()).toBe(404);
});
