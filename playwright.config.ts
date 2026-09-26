import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	timeout: 90000,
	expect: { timeout: 20000 },
	workers: 1,
	fullyParallel: false,
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		actionTimeout: 20000,
		baseURL: 'http://localhost:3002',
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure',
		serviceWorkers: 'block'
	},
	projects: [
		{ name: 'iphone-chromium', use: { ...devices['iPhone 15'], viewport: { width: 393, height: 852 }, browserName: 'chromium' } },
		{ name: 'android-small', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 800 } } },
		{ name: 'iphone-webkit', use: { ...devices['iPhone 15'], viewport: { width: 393, height: 852 }, browserName: 'webkit' } },
		{ name: 'iphone-small', use: { ...devices['iPhone SE'], browserName: 'webkit' } },
		{ name: 'iphone-large', use: { ...devices['iPhone 15 Pro Max'], viewport: { width: 430, height: 932 }, browserName: 'webkit' } },
		{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }
	]
});
