import { chromium, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomBytes, createHash } from 'node:crypto';

const db = new PrismaClient({ datasourceUrl: 'postgresql://postgres:postgres@localhost:5434/mediagame?schema=public' });
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
const context = browser.contexts()[0];
const page = context.pages()[0];
const users = [];
const tokens = [];
const run = randomBytes(5).toString('hex');
let teamId = '';
const teamIds = [];
let testSessionInstalled = false;
try {
	await page.goto('http://10.0.2.2:3002/home');
	const signedOut = await page.evaluate(async () => {
		const response = await fetch('/api/me', { cache: 'no-store' });
		return response.ok && !(await response.json()).user;
	});
	if (!signedOut) throw new Error('Use a signed-out test APK; existing user sessions will not be replaced.');
	const base = 76561198000000000n + BigInt(`0x${randomBytes(4).toString('hex')}`);
	for (let index = 0; index < 3; index++) {
		const user = await db.user.create({ data: { userId: `qa-native-${run}-${index}`, displayName: ['Лидер QA', 'Участник QA', 'Друг QA'][index], steamId: String(base + BigInt(index)), lastLoginAt: new Date() } });
		users.push(user.id);
		const token = randomBytes(32).toString('hex'); tokens.push(token);
		await db.session.create({ data: { userId: user.id, sessionToken: createHash('sha256').update(token).digest('hex'), expires: new Date(Date.now() + 600000) } });
	}
	const team = await db.team.create({ data: { name: `Пати QA ${run}`, game: 'Dota 2', createdById: users[0], members: { create: users.slice(0, 2).map((userId, index) => ({ userId, role: index === 0 ? 'captain' : 'member', confirmed: true, confirmedAt: new Date() })) } } });
	teamId = team.id;
	teamIds.push(teamId);
	const secondTeam = await db.team.create({ data: { name: `Второе пати QA ${run}`, game: 'Dota 2', createdById: users[1], members: { create: { userId: users[1], role: 'captain', confirmed: true, confirmedAt: new Date() } } } });
	teamIds.push(secondTeam.id);
	await context.addCookies([{ name: 'aegis_session', value: tokens[1], domain: '10.0.2.2', path: '/', httpOnly: true, sameSite: 'Lax' }]);
	testSessionInstalled = true;
	await page.goto(`http://10.0.2.2:3002/party-search?teamId=${teamId}`);
	await page.getByRole('button', { name: 'Состав', exact: true }).click();
	await expect(page.getByTestId('party-count')).toHaveText('2/5');
	await expect(page.getByRole('button', { name: /^Исключить/ })).toHaveCount(0);
	await page.getByRole('button', { name: 'Пригласить по ссылке', exact: true }).click();
	await expect(page.getByLabel('Ссылка приглашения', { exact: true })).toHaveValue(/join=[a-f0-9]{64}/);
	await page.getByRole('button', { name: 'Копировать', exact: true }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Ссылка скопирована' })).toBeVisible();
	const token = new URL(await page.getByLabel('Ссылка приглашения', { exact: true }).inputValue()).searchParams.get('join');
	await page.getByRole('button', { name: 'Закрыть пати', exact: true }).click();
	await page.getByRole('button', { name: `${secondTeam.name} · Steam 1 из 5`, exact: true }).click();
	await page.getByRole('button', { name: 'Состав', exact: true }).click();
	await expect(page.getByTestId('party-count')).toHaveText('1/5');
	await expect(page.getByLabel('Ссылка приглашения', { exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Закрыть пати', exact: true }).click();
	await page.getByRole('button', { name: `${team.name} · Steam 2 из 5`, exact: true }).click();
	await page.getByRole('button', { name: 'Состав', exact: true }).click();
	await expect(page.getByTestId('party-count')).toHaveText('2/5');
	const response = await fetch(`http://localhost:3002/api/party/links/${token}`, { method: 'POST', headers: { Origin: 'http://localhost:3002', Cookie: `aegis_session=${tokens[2]}` } });
	if (!response.ok) throw new Error(await response.text());
	await expect(page.getByTestId('party-count')).toHaveText('3/5', { timeout: 15000 });
	await page.getByRole('dialog').evaluate((dialog) => { dialog.scrollTop = 0; });
	await page.screenshot({ path: 'android/build/party-member-live.png' });
	console.log('PASS: APK member can copy a share URL on local HTTP; switching parties hides unrelated URLs; friend joins and roster updates to 3/5; no kick permission.');
} finally {
	if (testSessionInstalled) {
		await context.clearCookies({ name: 'aegis_session', domain: '10.0.2.2' });
		await page.goto('http://10.0.2.2:3002/home').catch(() => {});
	}
	await browser.close();
	if (teamIds.length) {
		await db.teamJoinLink.deleteMany({ where: { teamId: { in: teamIds } } });
		await db.teamMember.deleteMany({ where: { teamId: { in: teamIds } } });
		await db.team.deleteMany({ where: { id: { in: teamIds } } });
	}
	await db.notification.deleteMany({ where: { userId: { in: users } } });
	await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
	await db.user.deleteMany({ where: { id: { in: users } } });
	await db.$disconnect();
}
