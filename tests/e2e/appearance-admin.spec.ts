import { test, expect } from '@playwright/test';
import { PrismaClient, type SiteAppearance } from '@prisma/client';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import { STAND_ADMIN_ID } from '../../lib/stand-admin';
import { DEFAULT_SITE_APPEARANCE } from '../../lib/site-appearance';

// This suite uses a short-lived local session and restores the appearance it found.
test.describe('local appearance editor', () => {
	let prisma: PrismaClient;
	let original: SiteAppearance | null;
	let token: string;
	let sessionId: string;

	test.beforeAll(async ({}, info) => {
		test.skip(process.env.AEGIS_E2E_ADMIN !== '1' || info.project.name !== 'iphone-chromium', 'Explicit local admin test only');
		prisma = new PrismaClient({ datasourceUrl: 'postgresql://postgres:postgres@localhost:5434/mediagame?schema=public' });
		original = await prisma.siteAppearance.findUnique({ where: { id: 'primary' } });
		token = randomBytes(32).toString('hex');
		const session = await prisma.session.create({ data: {
			userId: STAND_ADMIN_ID, sessionToken: createHash('sha256').update(token).digest('hex'), expires: new Date(Date.now() + 10 * 60 * 1000)
		} });
		sessionId = session.id;
	});

	test.afterAll(async () => {
		if (!prisma) return;
		try {
			if (original) await prisma.siteAppearance.upsert({ where: { id: 'primary' }, create: original, update: original });
			else await prisma.siteAppearance.deleteMany({ where: { id: 'primary', updatedById: STAND_ADMIN_ID } });
			if (sessionId) await prisma.session.deleteMany({ where: { id: sessionId } });
		} finally { await prisma.$disconnect(); }
	});

	test('edits URLs, previews local and S3 uploads, and publishes settings', async ({ page, context }, info) => {
		test.setTimeout(240000);
		await context.addCookies([{ name: 'aegis_session', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
		await page.goto('/admin/appearance');
		await expect(page.getByRole('heading', { name: 'Оформление', exact: true })).toBeVisible();
		await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		await page.screenshot({ path: info.outputPath('admin-appearance.png'), animations: 'disabled', scale: 'css' });
		const before = await (await context.request.get('/api/admin/appearance')).json();
		const { id: _id, ...defaults } = DEFAULT_SITE_APPEARANCE;
		void _id;
		try {
			const wrongOrigin = await context.request.patch('/api/admin/appearance', { headers: { Origin: 'https://foreign.example' }, data: { motionEnabled: false } });
			expect(wrongOrigin.status()).toBe(403);
			const invalidUrl = await context.request.patch('/api/admin/appearance', { headers: { Origin: 'http://localhost:3002' }, data: { appLogoUrl: 'javascript:alert(1)' } });
			expect(invalidUrl.status()).toBe(400);
			const corrupt = await context.request.post('/api/admin/appearance/upload', {
				headers: { Origin: 'http://localhost:3002' },
				multipart: { field: 'dotaLogoUrl', storage: 'local', file: { name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('not an image') } }
			});
			expect(corrupt.status()).toBe(400);
			const motion = page.getByRole('checkbox', { name: 'Анимация' });
			await motion.setChecked(!before.appearance.motionEnabled);
			const asset = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Фон арены', exact: true }) });
			for (const storage of ['local', 's3'] as const) {
				await asset.getByRole('button', { name: storage === 'local' ? 'Папка' : 'S3', exact: true }).click();
				await asset.getByLabel('Файл: Фон арены').setInputFiles(path.resolve('public/brand/dota2-scene.webp'));
				const [response] = await Promise.all([
					page.waitForResponse((response) => response.url().endsWith('/api/admin/appearance/upload') && response.request().method() === 'POST', { timeout: 45000 }),
					asset.getByRole('button', { name: 'Загрузить', exact: true }).click()
				]);
				expect(response.ok(), await response.text()).toBe(true);
				const { url } = await response.json();
				expect(url).toContain(`/api/media/appearance/${storage}/appearance/backdrop/`);
				await expect(page.getByRole('status')).toContainText('Сохраните оформление');
				await expect(motion).toBeChecked({ checked: !before.appearance.motionEnabled });
				const media = await context.request.get(url);
				expect(media.ok()).toBe(true);
				expect(media.headers()['content-type']).toBe('image/webp');
				const unchanged = await (await context.request.get('/api/admin/appearance')).json();
				expect(unchanged.appearance.mobileBackdropUrl).not.toBe(url);
				await page.getByRole('button', { name: 'Сохранить оформление', exact: true }).click();
				await expect(page.getByRole('status')).toContainText('Оформление сохранено');
				const published = await (await context.request.get('/api/admin/appearance')).json();
				expect(published.appearance.mobileBackdropUrl).toBe(url);
			}
			const coverUrl = 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/570/library_hero.jpg';
			await page.getByLabel('URL: Обложка главной', { exact: true }).fill(coverUrl);
			await motion.setChecked(before.appearance.motionEnabled);
			await page.getByRole('button', { name: 'Сохранить оформление', exact: true }).click();
			await expect(page.getByRole('status')).toContainText('Оформление сохранено');
			expect((await (await context.request.get('/api/admin/appearance')).json()).appearance.homeCoverUrl).toBe(coverUrl);
			page.once('dialog', (dialog) => dialog.accept());
			await page.getByRole('button', { name: 'Восстановить стандартное оформление' }).click();
			await expect(page.getByRole('status')).toContainText('Стандартное оформление восстановлено');
			await page.goto('/home');
			await expect.poll(() => page.locator('.arena-cover-art').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
			await page.screenshot({ path: info.outputPath('admin-home.png'), animations: 'disabled', scale: 'css' });
		} finally {
			const appearance = before.appearance || defaults;
			const { id: _savedId, ...restore } = appearance;
			void _savedId;
			await context.request.patch('/api/admin/appearance', { headers: { Origin: 'http://localhost:3002' }, data: restore });
		}
	});
});
