import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test('PWA installs its worker, renders icons, and recovers from offline navigation', async ({ page, context, browserName }, info) => {
	test.skip(browserName !== 'chromium', 'Playwright Service Worker network testing is supported on Chromium; real iOS offline testing remains required.');
	test.setTimeout(120000);
	await page.goto('/home');
	await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
	const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
	expect(manifestHref).toBeTruthy();
	const manifestResponse = await context.request.get(manifestHref!);
	expect(manifestResponse.ok()).toBe(true);
	const manifest = await manifestResponse.json();
	expect(manifest).toMatchObject({ name: 'Aegis Arena', display: 'standalone', start_url: '/home', scope: '/' });
	for (const icon of manifest.icons) {
		const dimensions = await page.evaluate((src: string) => new Promise<number[]>((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
			img.onerror = () => reject(new Error('PWA icon failed to load'));
			img.src = src;
		}), icon.src);
		expect(dimensions.join('x')).toBe(icon.sizes);
	}
	try {
		await context.setOffline(true);
		const response = await page.goto('/party-search?pwa-check=offline');
		expect(response?.fromServiceWorker()).toBe(true);
		await expect(page.getByRole('heading', { name: 'Нет соединения' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Повторить', exact: true })).toBeVisible();
		expect(await page.locator('script, link[rel="stylesheet"]').count()).toBe(0);
		await expect.poll(() => page.locator('main img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth >= 48)).toBe(true);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		await page.screenshot({ path: info.outputPath('pwa-offline.png'), scale: 'css' });
		await context.setOffline(false);
		await page.getByRole('link', { name: 'Повторить', exact: true }).click();
		await expect(page).toHaveURL(/\/party-search\?pwa-check=offline$/);
		await expect(page.getByRole('region', { name: 'Моё пати', exact: true })).toBeVisible();
	} finally {
		await context.setOffline(false);
	}
});

test('PWA never substitutes its offline page for Steam auth or protected APIs', async ({ page, context, browserName }) => {
	test.skip(browserName !== 'chromium', 'Playwright Service Worker network testing is supported on Chromium; real iOS offline testing remains required.');
	await page.goto('/home');
	await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
	try {
		await context.setOffline(true);
		const apiFailed = await page.evaluate(async () => {
			try { await fetch('/api/me', { cache: 'no-store' }); return false; }
			catch { return true; }
		});
		expect(apiFailed).toBe(true);
		let authFailed = false;
		try { await page.goto('/api/auth/steam?next=%2Fparty-search', { timeout: 15000 }); }
		catch { authFailed = true; }
		expect(authFailed).toBe(true);
		await expect(page.getByRole('heading', { name: 'Нет соединения' })).toHaveCount(0);
	} finally {
		await context.setOffline(false);
	}
});

test('standalone offline document has usable layout and Home navigation', async ({ page }, info) => {
	await page.goto('/offline.html');
	await expect(page.getByRole('heading', { name: 'Нет соединения', exact: true })).toBeVisible();
	await expect.poll(() => page.locator('main img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth >= 48)).toBe(true);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	expect(await page.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor)).toBe('rgb(9, 16, 20)');
	await page.screenshot({ path: info.outputPath('offline-document.png'), scale: 'css' });
	await page.getByRole('link', { name: 'На главную', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Вступай в игру' })).toBeVisible();
});
