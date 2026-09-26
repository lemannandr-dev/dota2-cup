import { test, expect, type BrowserContext, type APIResponse } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';

test('party: solo leader, invitation dialog, member links, concurrent seats and bracket lock', async ({ browser }, info) => {
	test.skip(process.env.AEGIS_E2E_PARTY !== '1', 'Explicit local fixture test only');
	test.setTimeout(300000);
	const db = new PrismaClient({ datasourceUrl: 'postgresql://postgres:postgres@localhost:5434/mediagame?schema=public' });
	const run = randomBytes(5).toString('hex');
	const userIds: string[] = [];
	const contexts: BrowserContext[] = [];
	let cupId = '';
	const origin = 'http://localhost:3002';
	async function json(response: APIResponse) { expect(response.ok(), await response.text()).toBe(true); return response.json(); }
	async function post(index: number, url: string, data: unknown = {}) { return contexts[index].request.post(url, { data, headers: { Origin: origin } }); }
	async function accept(index: number, id: string) { return contexts[index].request.patch(`/api/teams/invitations/${id}`, { data: { action: 'ACCEPTED' }, headers: { Origin: origin } }); }
	try {
		const steamBase = 76561198000000000n + BigInt(`0x${randomBytes(4).toString('hex')}`);
		for (let index = 0; index < 12; index++) {
			const user = await db.user.create({ data: { userId: `qa-${run}-${index}`, displayName: `Party QA ${run} ${index}`, steamId: String(steamBase + BigInt(index)), lastLoginAt: new Date() } });
			userIds.push(user.id);
			const token = randomBytes(32).toString('hex');
			await db.session.create({ data: { userId: user.id, sessionToken: createHash('sha256').update(token).digest('hex'), expires: new Date(Date.now() + 600000) } });
			const context = await browser.newContext({ baseURL: origin, viewport: info.project.use.viewport ?? { width: 393, height: 852 }, isMobile: info.project.use.isMobile, hasTouch: true });
			await context.addCookies([{ name: 'aegis_session', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
			contexts.push(context);
		}
		const cup = await db.tournament.create({ data: { title: `Party QA ${run}`, status: 'REGISTRATION', startAt: new Date(Date.now() + 30 * 86400000), checkInOpensAt: new Date(Date.now() + 86400000), checkInClosesAt: new Date(Date.now() + 2 * 86400000), staff: { create: { userId: userIds[11], role: 'OWNER' } } } });
		cupId = cup.id;
		await db.lfgPost.create({ data: { userId: userIds[1], roles: [5], expiresAt: new Date(Date.now() + 600000) } });
		const leaderPage = await contexts[0].newPage();
		const recipientPage = await contexts[1].newPage();
		await leaderPage.goto(`/party-search?tab=players&playerId=${userIds[1]}&tournamentId=${cup.id}`);
		await leaderPage.locator('article').filter({ has: leaderPage.getByRole('link', { name: `Party QA ${run} 1`, exact: true }) }).getByRole('button', { name: 'Пригласить в пати', exact: true }).click();
		await expect(leaderPage.getByRole('dialog')).toContainText('становитесь лидером');
		await leaderPage.getByRole('button', { name: 'Отправить приглашение', exact: true }).click();
		await expect(leaderPage.getByRole('status').filter({ hasText: 'Ожидаем ответ' })).toBeVisible();
		await expect(leaderPage.getByTestId('party-count')).toHaveText('1/5');
		const invite = await db.teamInvite.findFirstOrThrow({ where: { fromUserId: userIds[0], toUserId: userIds[1] } });
		expect(invite.tournamentId).toBe(cup.id);
		const teamId = invite.teamId;
		expect((await db.team.findUniqueOrThrow({ where: { id: teamId } })).createdById).toBe(userIds[0]);

		// A tournament-linked notification must open the invitation, not the bracket.
		await recipientPage.goto('/party-search');
		await recipientPage.getByRole('button', { name: /Уведомления:/ }).click();
		await recipientPage.getByRole('button', { name: /Приглашение в пати/ }).click();
		await expect(recipientPage.getByRole('dialog')).toBeVisible();
		await expect(recipientPage.getByTestId('party-count')).toHaveText('1/5');
		await expect(recipientPage.getByRole('dialog')).toContainText(`Лидер: Party QA ${run} 0`);
		await recipientPage.screenshot({ path: info.outputPath('party-invitation.png'), scale: 'css' });
		await recipientPage.getByRole('button', { name: 'Принять приглашение', exact: true }).click();
		await expect(recipientPage.getByTestId('party-count')).toHaveText('2/5');
		await expect(leaderPage.getByTestId('party-count')).toHaveText('2/5', { timeout: 15000 });
		expect(await db.lfgPost.count({ where: { userId: userIds[1] } })).toBe(0);
		expect((await db.teamMember.findUniqueOrThrow({ where: { teamId_userId: { teamId, userId: userIds[1] } } })).role).toBe('member');

		await recipientPage.getByRole('button', { name: 'Пригласить по ссылке', exact: true }).click();
		const share = recipientPage.getByLabel('Ссылка приглашения', { exact: true });
		await expect(share).toHaveValue(/join=[a-f0-9]{64}/);
		const link = new URL(await share.inputValue());
		const token = link.searchParams.get('join')!;
		const preview = await json(await contexts[2].request.get(`/api/party/links/${token}`));
		expect(preview.invite.party.roster.confirmed).toBe(2);
		expect(preview.invite.fromUser.displayName).toBe(`Party QA ${run} 1`);
		expect(preview.invite.party.leader.id).toBe(userIds[0]);
		await json(await post(2, `/api/party/links/${token}`));
		expect((await db.team.findUniqueOrThrow({ where: { id: teamId } })).createdById).toBe(userIds[0]);
		expect((await post(1, `/api/teams/${teamId}/members`, { action: 'kick', userId: userIds[2] })).status()).toBe(403);
		expect((await post(1, '/api/teams/invitations', { teamId, toUserId: userIds[3], role: 'captain' })).status()).toBe(400);
		expect((await contexts[1].request.post('/api/party/links', { data: { teamId }, headers: { Origin: 'https://foreign.example' } })).status()).toBe(403);

		const fourth = await json(await post(0, '/api/teams/invitations', { teamId, toUserId: userIds[3] }));
		await json(await accept(3, fourth.invite.id));
		const fifth = await json(await post(0, '/api/teams/invitations', { teamId, toUserId: userIds[4] }));
		const sixth = await json(await post(0, '/api/teams/invitations', { teamId, toUserId: userIds[5] }));
		const races = await Promise.all([accept(4, fifth.invite.id), accept(5, sixth.invite.id)]);
		expect(races.map((res) => res.status()).sort()).toEqual([200, 409]);
		expect(await db.teamMember.count({ where: { teamId, confirmed: true, isSubstitute: false } })).toBe(5);
		const failedInviteId = races[0].status() === 409 ? fifth.invite.id : sixth.invite.id;
		expect((await db.teamInvite.findUniqueOrThrow({ where: { id: failedInviteId } })).status).toBe('PENDING');

		// Only the leader submits the same five-player team used by party invitations.
		const deniedRegistration = await post(1, `/api/tournaments/${cup.id}/register`, { teamId });
		expect(deniedRegistration.status(), await deniedRegistration.text()).toBe(403);
		await json(await post(0, `/api/tournaments/${cup.id}/register`, { teamId }));
		await db.teamApplication.update({ where: { teamId_tournamentId: { teamId, tournamentId: cup.id } }, data: { status: 'APPROVED' } });
		await json(await post(0, `/api/teams/${teamId}/members`, { action: 'kick', userId: userIds[2] }));
		expect((await db.teamApplication.findUniqueOrThrow({ where: { teamId_tournamentId: { teamId, tournamentId: cup.id } } })).status).toBe('SUBMITTED');
		expect((await post(2, `/api/party/links/${token}`)).status()).toBe(410);
		expect((await post(0, `/api/tournaments/${cup.id}/check-in`, { teamId })).status()).toBe(400);
		const returnInvite = await json(await post(0, '/api/teams/invitations', { teamId, toUserId: userIds[2] }));
		await json(await accept(2, returnInvite.invite.id));

		// Conflict must not consume a pending invitation.
		const outsiderTeam = await db.team.create({ data: { name: `Opponents ${run}`, game: 'Dota 2', createdById: userIds[6], members: { create: userIds.slice(6, 11).map((id, index) => ({ userId: id, role: index === 0 ? 'captain' : 'member', confirmed: true, confirmedAt: new Date() })) } } });
		await db.teamApplication.create({ data: { teamId: outsiderTeam.id, tournamentId: cup.id, status: 'APPROVED' } });
		await json(await post(0, `/api/teams/${teamId}/members`, { action: 'kick', userId: userIds[2] }));
		const conflictInvite = await json(await post(0, '/api/teams/invitations', { teamId, toUserId: userIds[6], tournamentId: cup.id }));
		expect((await accept(6, conflictInvite.invite.id)).status()).toBe(409);
		expect((await db.teamInvite.findUniqueOrThrow({ where: { id: conflictInvite.invite.id } })).status).toBe('PENDING');
		const finalInvite = await json(await post(0, '/api/teams/invitations', { teamId, toUserId: userIds[2] }));
		await json(await accept(2, finalInvite.invite.id));
		await db.teamApplication.update({ where: { teamId_tournamentId: { teamId, tournamentId: cup.id } }, data: { status: 'APPROVED' } });
		await db.tournament.update({ where: { id: cup.id }, data: { status: 'CHECK_IN', checkInOpensAt: new Date(Date.now() - 60000) } });
		await json(await post(0, `/api/tournaments/${cup.id}/check-in`, { teamId }));
		await json(await post(6, `/api/tournaments/${cup.id}/check-in`, { teamId: outsiderTeam.id }));
		expect((await post(0, `/api/teams/${teamId}/members`, { action: 'kick', userId: userIds[1] })).status()).toBe(409);
		expect((await post(0, '/api/party/links', { teamId })).status()).toBe(409);
		expect((await post(0, `/api/tournaments/${cup.id}/bracket`)).status()).toBe(403);
		await json(await post(11, `/api/tournaments/${cup.id}/bracket`));
		expect(await db.match.count({ where: { tournamentId: cup.id } })).toBeGreaterThan(0);
		expect((await db.teamApplication.findUniqueOrThrow({ where: { teamId_tournamentId: { teamId, tournamentId: cup.id } } })).status).toBe('IN_BRACKET');
		await expect(leaderPage.getByTestId('party-count')).toHaveText('5/5');
		await expect(leaderPage.getByRole('dialog')).toContainText('Состав зафиксирован');
		await expect(leaderPage.getByRole('button', { name: `Исключить Party QA ${run} 1`, exact: true })).toBeDisabled();
		expect(await leaderPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		await leaderPage.screenshot({ path: info.outputPath('party-locked-roster.png'), scale: 'css' });
	} finally {
		const closeErrors: unknown[] = [];
		for (const context of contexts) await context.close().catch((error) => { closeErrors.push(error); });
		const teams = await db.team.findMany({ where: { createdById: { in: userIds } }, select: { id: true } });
		const teamIds = teams.map((team) => team.id);
		if (cupId) {
			await db.match.deleteMany({ where: { tournamentId: cupId } });
			await db.teamApplication.deleteMany({ where: { tournamentId: cupId } });
			await db.tournament.delete({ where: { id: cupId } });
		}
		await db.teamJoinLink.deleteMany({ where: { teamId: { in: teamIds } } });
		await db.teamInvite.deleteMany({ where: { teamId: { in: teamIds } } });
		await db.teamMember.deleteMany({ where: { teamId: { in: teamIds } } });
		await db.team.deleteMany({ where: { id: { in: teamIds } } });
		await db.notification.deleteMany({ where: { userId: { in: userIds } } });
		await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, ...(cupId ? [{ entityId: cupId }] : [])] } });
		await db.user.deleteMany({ where: { id: { in: userIds } } });
		await db.$disconnect();
		if (closeErrors.length) throw new AggregateError(closeErrors, 'Browser contexts could not finish recording');
	}
});

test('guest mobile login preserves invite and offers retry after cancellation', async ({ page, context }) => {
	await page.goto('/party-search?join=' + 'a'.repeat(64));
	await expect(page.getByRole('dialog')).toBeVisible();
	const href = await page.getByRole('dialog').getByRole('link', { name: 'Войти через Steam' }).getAttribute('href');
	expect(new URL(href!, 'http://localhost:3002').searchParams.get('next')).toBe('/party-search?join=' + 'a'.repeat(64));
	const response = await context.request.get(href!, { maxRedirects: 0 });
	expect(response.status()).toBe(307);
	const steam = new URL(response.headers().location);
	const callback = new URL(steam.searchParams.get('openid.return_to')!);
	expect(callback.origin).toBe('http://localhost:3002');
	callback.searchParams.set('openid.mode', 'cancel');
	await page.goto(callback.href);
	await expect(page.getByRole('alert').filter({ hasText: 'Вход отменён' })).toBeVisible();
	const retry = await page.getByRole('link', { name: 'Повторить вход через Steam' }).getAttribute('href');
	expect(new URL(retry!, 'http://localhost:3002').searchParams.get('next')).toBe('/party-search?join=' + 'a'.repeat(64));
});
