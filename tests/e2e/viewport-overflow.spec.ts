import { test, expect } from '@playwright/test';

/**
 * Stage-6: no document-level horizontal scroll on core guest routes
 * across the mobile viewport matrix from docs/mobile-roadmap.md.
 */
const ROUTES = ['/home', '/tournaments', '/party-search', '/teams', '/heroes', '/legal'] as const;
const WIDTHS = [320, 360, 375, 393, 412, 430, 768, 1024] as const;

test('core routes: no horizontal page overflow across viewports', async ({ page }, info) => {
	test.skip(info.project.name !== 'desktop', 'Viewport matrix uses desktop project + resize');
	test.setTimeout(180000);

	for (const width of WIDTHS) {
		await page.setViewportSize({ width, height: 900 });
		for (const route of ROUTES) {
			await page.goto(route, { waitUntil: 'domcontentloaded' });
			await page.evaluate(() => document.fonts.ready);
			const overflow = await page.evaluate(() => {
				const doc = document.documentElement;
				return {
					scrollWidth: doc.scrollWidth,
					clientWidth: doc.clientWidth,
					bodyScroll: document.body.scrollWidth
				};
			});
			expect(
				overflow.scrollWidth,
				`${route} @ ${width}px: scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}`
			).toBeLessThanOrEqual(overflow.clientWidth + 1);
			expect(overflow.bodyScroll).toBeLessThanOrEqual(overflow.clientWidth + 1);
		}
	}
});

test('mobile project: home and cups stay within viewport width', async ({ page }, info) => {
	test.skip(info.project.name === 'desktop', 'Covered by matrix on desktop project');
	for (const route of ['/home', '/tournaments', '/party-search'] as const) {
		await page.goto(route, { waitUntil: 'domcontentloaded' });
		await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
	}
});
