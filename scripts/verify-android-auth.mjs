import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const exec = promisify(execFile);
const adb = join(process.env.ANDROID_HOME || join(process.env.LOCALAPPDATA, 'Android', 'Sdk'), 'platform-tools', 'adb.exe');
async function nativeErrorControls() {
	for (let attempt = 0; attempt < 8; attempt++) {
		await exec(adb, ['shell', 'uiautomator', 'dump', '/sdcard/aegis-auth-test.xml']);
		const { stdout } = await exec(adb, ['shell', 'cat', '/sdcard/aegis-auth-test.xml']);
		const controls = await page.evaluate((xml) => {
			const doc = new DOMParser().parseFromString(xml, 'application/xml');
			return {
				title: doc.querySelector('[resource-id$="/auth_error_title"]')?.getAttribute('text'),
				retry: doc.querySelector('[resource-id$="/auth_retry"]')?.getAttribute('bounds'),
				home: doc.querySelector('[resource-id$="/auth_home"]')?.getAttribute('bounds')
			};
		}, stdout);
		if (controls.title === 'Steam не открылся' && controls.retry && controls.home) return controls;
	}
	throw new Error('Native Steam recovery controls did not appear');
}

// Connect only to the debug WebView forwarded from the local Android emulator.
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
const page = browser.contexts()[0].pages()[0];
const appOrigin = 'http://10.0.2.2:3002';
const target = `/party-search?join=${'b'.repeat(64)}`;
try {
	await page.goto(appOrigin + '/home');
	const signedOut = await page.evaluate(async () => {
		const response = await fetch('/api/me', { cache: 'no-store' });
		return response.ok && !(await response.json()).user;
	});
	assert(signedOut, 'Use a signed-out test APK; do not interrupt a real Steam session.');
	await page.goto(appOrigin + target);
	await page.getByRole('dialog').getByRole('link', { name: 'Войти через Steam' }).click();
	await page.waitForURL('https://steamcommunity.com/**', { timeout: 30000 });
	await page.locator('input[type="password"]').waitFor({ state: 'visible', timeout: 30000 });
	await page.screenshot({ path: 'android/build/auth-steam-form.png' });
	console.log('PASS: the APK opens the real Steam sign-in form; no credentials entered.');

	for (let attempt = 1; attempt <= 3; attempt++) {
		await page.context().setOffline(true);
		await page.reload({ waitUntil: 'commit', timeout: 10000 }).catch(() => {});
		const controls = await nativeErrorControls();
		const screenshot = await exec(adb, ['exec-out', 'screencap', '-p'], { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 });
		await writeFile('android/build/auth-network-retry.png', screenshot.stdout);
		await page.context().setOffline(false);
		const started = page.waitForRequest((req) => req.url().startsWith(appOrigin + '/api/auth/steam?'));
		const [left, top, right, bottom] = controls.retry.match(/\d+/g).map(Number);
		await exec(adb, ['shell', 'input', 'tap', String(Math.round((left + right) / 2)), String(Math.round((top + bottom) / 2))]);
		const request = await started;
		assert.equal(new URL(request.url()).searchParams.get('next'), target);
		await page.waitForURL('https://steamcommunity.com/**', { timeout: 30000 });
		await page.locator('input[type="password"]').waitFor({ state: 'visible', timeout: 30000 });
		console.log(`PASS ${attempt}/3: network recovery preserves the invitation and reopens Steam.`);
	}
	await page.context().setOffline(true);
	await page.reload({ waitUntil: 'commit', timeout: 10000 }).catch(() => {});
	const controls = await nativeErrorControls();
	await page.context().setOffline(false);
	const [left, top, right, bottom] = controls.home.match(/\d+/g).map(Number);
	await exec(adb, ['shell', 'input', 'tap', String(Math.round((left + right) / 2)), String(Math.round((top + bottom) / 2))]);
	await page.waitForURL(appOrigin + '/home', { timeout: 30000 });
	await page.getByRole('heading', { name: 'Вступай в игру' }).waitFor({ timeout: 30000 });
	console.log('PASS: the native Home button leaves the network error and opens the app.');
} finally {
	await page.context().setOffline(false).catch(() => {});
	await browser.close();
}
