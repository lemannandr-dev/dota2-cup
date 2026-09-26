import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';

async function assertHeader(page: Page) {
	await page.evaluate(() => document.fonts.ready);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	const header = page.locator('[data-site-header]');
	for (const control of await header.locator('a:visible, button:visible').all()) {
		await expect(control).toBeInViewport();
		expect(await control.evaluate((element) => {
			const rect = element.getBoundingClientRect();
			const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
			return rect.left >= 0 && rect.right <= innerWidth && Boolean(target && element.contains(target));
		})).toBe(true);
	}
}

test('public home: artwork, compact header and working menu', async ({ page }, info) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'AEGIS ARENA', exact: true })).toBeVisible();
	await expect.poll(() => page.locator('.arena-cover-art').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
	await assertHeader(page);
	const coverBottom = await page.locator('.arena-cover').evaluate((element) => element.getBoundingClientRect().bottom);
	expect(coverBottom).toBeLessThan((page.viewportSize()?.height ?? 0) - 80);
	await page.screenshot({ path: info.outputPath('public-home.png'), animations: 'disabled', scale: 'css' });
	const toggle = page.getByRole('button', { name: 'Открыть меню', exact: true });
	if (await toggle.isVisible()) {
		await toggle.click();
		await expect(page.getByRole('navigation', { name: 'Меню арены' })).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(toggle).toBeFocused();
		await toggle.click();
		await page.getByRole('navigation', { name: 'Меню арены' }).getByRole('link', { name: 'Главная', exact: true }).click();
		await expect(page).toHaveURL(/\/home$/);
		await expect(page.getByRole('navigation', { name: 'Меню арены' })).toBeHidden();
	} else {
		await page.locator('.arena-cover').getByRole('link', { name: 'Найти турнир', exact: true }).click();
		await expect(page).toHaveURL(/\/tournaments$/);
	}
});

test('home header stays usable across tablet and narrow breakpoints', async ({ page }, info) => {
	test.skip(info.project.name !== 'desktop', 'Breakpoint sweep uses desktop resizing');
	for (const width of [320, 768, 1024, 1280, 1920]) {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/home');
		await assertHeader(page);
		await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
		expect(await page.locator('[data-site-header]').evaluate((element) => Math.abs(element.getBoundingClientRect().top))).toBeLessThanOrEqual(1);
		await page.evaluate(() => window.scrollTo(0, 0));
	}
});

test('signed-in home: compact cover, notifications and party dialog', async ({ page, context }, info) => {
	test.skip(process.env.AEGIS_E2E_PARTY !== '1', 'Explicit local fixture test only');
	test.setTimeout(180000);
	const db = new PrismaClient({ datasourceUrl: 'postgresql://postgres:postgres@localhost:5434/mediagame?schema=public' });
	let userId = '';
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	try {
		const token = randomBytes(32).toString('hex');
		const user = await db.user.create({ data: {
			userId: `home-qa-${randomBytes(6).toString('hex')}`,
			displayName: 'HomeLayoutQA'.repeat(8),
			steamId: String(76561198000000000n + BigInt(`0x${randomBytes(4).toString('hex')}`))
		} });
		userId = user.id;
		await db.session.create({ data: { userId, sessionToken: createHash('sha256').update(token).digest('hex'), expires: new Date(Date.now() + 600000) } });
		await context.addCookies([{ name: 'aegis_session', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
		const widths = info.project.name === 'desktop' ? [320, 768, 1024, 1280, 1440] : [page.viewportSize()!.width];
		for (const width of widths) {
			await page.setViewportSize({ width, height: page.viewportSize()!.height });
			await page.goto('/home');
			await expect(page.locator('[data-home-desk]')).toBeVisible();
			await expect(page.locator('[data-home-roster] li')).toHaveCount(5);
			await expect(page.locator('[data-home-cup]')).toBeVisible();
			await expect(page.locator('[data-home-play]')).toBeVisible();
			await expect(page.getByRole('button', { name: 'Действия главной' })).toBeVisible();
			await assertHeader(page);
			expect(await page.locator('.arena-cover.is-stage').evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(400);
			await page.getByRole('button', { name: /^Уведомления:/ }).click();
			const notifications = page.getByRole('region', { name: 'Уведомления', exact: true });
			await expect(notifications).toBeVisible();
			expect(await notifications.evaluate((element) => { const rect = element.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth; })).toBe(true);
			await page.getByRole('button', { name: 'Закрыть уведомления' }).click();
			await page.screenshot({ path: info.outputPath(`signed-home-${width}.png`), animations: 'disabled', scale: 'css' });
		}
		await page.goto('/party-search');
		await page.getByRole('button', { name: 'Состав', exact: true }).click();
		const dialog = page.getByRole('dialog', { name: 'Моё пати', exact: true });
		await expect(dialog).toBeVisible();
		await expect(dialog).toHaveCSS('background-color', 'rgb(16, 21, 24)');
		const invite = dialog.getByRole('button', { name: 'Пригласить по ссылке', exact: true });
		await invite.click({ trial: true });
		expect(await invite.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
		await page.screenshot({ path: info.outputPath('party-dialog.png'), animations: 'disabled', scale: 'css' });
		await dialog.getByRole('button', { name: 'Закрыть пати' }).click();
		await expect(dialog).toBeHidden();
		expect(errors).toEqual([]);
	} finally {
		await context.clearCookies();
		if (userId) {
			await db.session.deleteMany({ where: { userId } });
			await db.user.delete({ where: { id: userId } });
		}
		await db.$disconnect();
	}
});
