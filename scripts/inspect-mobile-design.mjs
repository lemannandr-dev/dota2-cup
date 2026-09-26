import { chromium, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch();
try {
	const context = await browser.newContext({ ...devices['iPhone 15'], serviceWorkers: 'block' });
	const page = await context.newPage();
	await mkdir('android/build/design-review', { recursive: true });
	for (const route of ['home', 'tournaments', 'teams']) {
		await page.goto(`http://localhost:3002/${route}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
		await page.locator('main:visible').last().waitFor();
		await page.screenshot({ path: `android/build/design-review/${route}.png`, animations: 'disabled', scale: 'css' });
		console.log(route, await page.evaluate(() => ({
			inner: [innerWidth, innerHeight], client: [document.documentElement.clientWidth, document.documentElement.clientHeight],
			scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
			viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content'),
			overflow: [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > innerWidth + 2 && getComputedStyle(el).position !== 'fixed').slice(0, 8).map((el) => ({ tag: el.tagName, cls: el.className }))
		})));
	}
} finally { await browser.close(); }
