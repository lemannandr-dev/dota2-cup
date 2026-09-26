import { chromium } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const mode = process.argv[2];
if (!['prepare', 'verify', 'session'].includes(mode)) throw new Error('Usage: node scripts/verify-android-manual-auth.mjs prepare|verify|session');
const origin = 'http://10.0.2.2:3002';
const statePath = 'android/build/manual-auth-check.json';
const resultPath = 'android/build/manual-auth-result.json';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
const page = browser.contexts()[0].pages()[0];
let db;

async function record(result, path = resultPath) {
	await writeFile(path, JSON.stringify({ checkedAt: new Date().toISOString(), ...result }, null, 2));
	console.log(JSON.stringify(result));
}

const readUserId = () => page.evaluate(async () => {
	const response = await fetch('/api/me', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
	if (!response.ok) return null;
	return (await response.json()).user?.id || null;
});

try {
	await mkdir('android/build', { recursive: true });
	if (mode === 'prepare') {
		const state = { startedAt: new Date().toISOString(), target: `/party-search?qa-login=${randomUUID()}` };
		await writeFile(statePath, JSON.stringify(state, null, 2));
		await record({ status: 'PENDING', reason: 'Manual Steam sign-in required; no credentials are read or stored.' });
		await page.goto(`${origin}/api/auth/steam?next=${encodeURIComponent(state.target)}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
		if (new URL(page.url()).origin !== 'https://steamcommunity.com' && page.url() !== origin + state.target) throw new Error('Steam sign-in did not open; inspect the application error page.');
		console.log('READY: finish Steam sign-in in the emulator, then run this script with verify.');
	} else if (mode === 'session') {
		if (new URL(page.url()).origin !== origin) throw new Error('Open an application page first; an in-progress Steam login will not be interrupted.');
		const userId = await readUserId();
		if (!userId) throw new Error('No signed-in application session to verify.');
		await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
		if (await readUserId() !== userId) throw new Error('Application session did not survive reload.');
		db = new PrismaClient({ datasourceUrl: 'postgresql://postgres:postgres@localhost:5434/mediagame?schema=public' });
		const callback = await db.auditLog.findFirst({ where: { actorId: userId, action: 'STEAM_LOGIN_SUCCEEDED' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
		// Supply this flag only after the user explicitly confirms completing the Guard challenge.
		const guardConfirmedByUser = process.argv.includes('--guard-confirmed');
		await record({
			status: 'PASS', scope: 'existing_session', sessionSurvivesReload: true,
			latestSteamCallbackAt: callback?.createdAt.toISOString() || null,
			steamGuard: guardConfirmedByUser ? 'confirmed_by_user' : 'not_verified',
			originalInviteReturn: 'not_observed_in_this_session_check'
		}, 'android/build/session-persistence-result.json');
	} else {
		const state = JSON.parse(await readFile(statePath, 'utf8'));
		if (typeof state.target !== 'string' || !/^\/party-search\?qa-login=[a-f0-9-]{36}$/.test(state.target) || !Number.isFinite(Date.parse(state.startedAt))) throw new Error('Invalid manual test state; run prepare again.');
		if (page.url() !== origin + state.target) {
			await record({ status: 'PENDING', reason: 'The browser has not returned to the expected page after Steam sign-in.' });
			process.exitCode = 2;
		} else {
			const userId = await readUserId();
			if (!userId) throw new Error('Returned from Steam but the application session is absent.');
			db = new PrismaClient({ datasourceUrl: 'postgresql://postgres:postgres@localhost:5434/mediagame?schema=public' });
			const callback = await db.auditLog.findFirst({ where: { actorId: userId, action: 'STEAM_LOGIN_SUCCEEDED', createdAt: { gte: new Date(state.startedAt) } }, select: { id: true } });
			if (!callback) throw new Error('No successful Steam callback was recorded for this sign-in.');
			await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
			if (await readUserId() !== userId) throw new Error('Application session did not survive reload.');
			await record({ status: 'PASS', steamCallbackVerified: true, expectedReturnVerified: true, sessionSurvivesReload: true, steamGuardChallenge: 'Only the user can confirm whether Steam requested Guard.' });
		}
	}
} finally {
	await db?.$disconnect();
	await browser.close();
}
