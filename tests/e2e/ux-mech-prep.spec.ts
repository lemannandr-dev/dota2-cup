import { test, expect } from '@playwright/test';

test('bottom sheet still closes via the X button', async ({ page }, info) => {
	test.skip(!/iphone/i.test(info.project.name), 'Install sheet is visible on iOS user agents');
	await page.goto('/home');
	await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
	await page.getByRole('button', { name: 'Установить Aegis Arena' }).click();
	const dialog = page.getByRole('dialog', { name: 'Установить Aegis Arena' });
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
	await expect(dialog).toBeHidden();
});

test('offline mutation queue flushes when the tab comes back online', async ({ page, browserName }) => {
	test.skip(browserName !== 'chromium', 'Playwright offline + SW recovery is Chromium-only, same as pwa-recovery');
	await page.goto('/home');
	await page.evaluate(() => {
		sessionStorage.setItem(
			'aegis.offlineQueue.v1',
			JSON.stringify([
				{
					id: 'e2e-oq-1',
					url: '/api/home/live',
					method: 'GET',
					idempotencyKey: 'e2e-oq-1',
					label: 'Home live',
					createdAt: Date.now()
				}
			])
		);
	});
	const flushed = page.waitForRequest((req) => req.url().includes('/api/home/live') && req.method() === 'GET');
	await page.evaluate(() => window.dispatchEvent(new Event('online')));
	await flushed;
	await expect(page.getByRole('status').filter({ hasText: 'Отправлено из очереди' }).first()).toBeVisible();
	expect(await page.evaluate(() => sessionStorage.getItem('aegis.offlineQueue.v1'))).toBe('[]');
});

test('offline enqueue stores the mutation until the network returns', async ({ page, context, browserName }) => {
	test.skip(browserName !== 'chromium', 'Playwright offline testing is Chromium-only');
	await page.goto('/home');
	await context.setOffline(true);
	await page.evaluate(async () => {
		try {
			await fetch('/api/home/live', { cache: 'no-store' });
		} catch {
			sessionStorage.setItem(
				'aegis.offlineQueue.v1',
				JSON.stringify([
					{
						id: 'e2e-oq-offline',
						url: '/api/home/live',
						method: 'GET',
						idempotencyKey: 'e2e-oq-offline',
						label: 'Home live',
						createdAt: Date.now()
					}
				])
			);
		}
	});
	expect(JSON.parse((await page.evaluate(() => sessionStorage.getItem('aegis.offlineQueue.v1'))) || '[]')).toHaveLength(1);
	await context.setOffline(false);
	const flushed = page.waitForRequest((req) => req.url().includes('/api/home/live') && req.method() === 'GET');
	await page.evaluate(() => window.dispatchEvent(new Event('online')));
	await flushed;
	await expect(page.getByRole('status').filter({ hasText: 'Отправлено из очереди' }).first()).toBeVisible();
});
