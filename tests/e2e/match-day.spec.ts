import { test, expect, type BrowserContext, type APIResponse } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';

/**
 * Captain + organizer match-day under real aegis_session cookies (Steam-shaped users).
 * Opt-in: AEGIS_E2E_MATCHDAY=1 or AEGIS_E2E_PARTY=1 against docker :3002 / postgres :5434.
 */
test('match-day: lobby, dual captain report, org desk under steam sessions', async ({ browser }, info) => {
	test.skip(
		process.env.AEGIS_E2E_MATCHDAY !== '1' && process.env.AEGIS_E2E_PARTY !== '1',
		'Explicit local fixture test only'
	);
	test.setTimeout(240000);

	const db = new PrismaClient({
		datasourceUrl: 'postgresql://postgres:postgres@localhost:5434/mediagame?schema=public'
	});
	const run = randomBytes(4).toString('hex');
	const origin = 'http://localhost:3002';
	const steamBase = 76561199100000000n + BigInt(`0x${randomBytes(4).toString('hex')}`);

	const userIds: string[] = [];
	const tokens: string[] = [];
	const contexts: BrowserContext[] = [];
	let tournamentId = '';
	let matchId = '';
	let teamAId = '';
	let teamBId = '';

	async function json(response: APIResponse) {
		expect(response.ok(), await response.text()).toBe(true);
		return response.json();
	}

	async function sessionFor(index: number) {
		const context = await browser.newContext({
			baseURL: origin,
			viewport: info.project.use.viewport ?? { width: 1440, height: 1000 }
		});
		await context.addCookies([
			{ name: 'aegis_session', value: tokens[index], domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }
		]);
		contexts.push(context);
		return context;
	}

	try {
		for (let index = 0; index < 11; index++) {
			const user = await db.user.create({
				data: {
					userId: `md-${run}-${index}`,
					displayName: index === 0 ? `MD Org ${run}` : `MD Player ${run} ${index}`,
					steamId: String(steamBase + BigInt(index)),
					role: index === 0 ? 'ORGANIZER' : 'USER',
					lastLoginAt: new Date()
				}
			});
			userIds.push(user.id);
			const token = randomBytes(32).toString('hex');
			tokens.push(token);
			await db.session.create({
				data: {
					userId: user.id,
					sessionToken: createHash('sha256').update(token).digest('hex'),
					expires: new Date(Date.now() + 30 * 60_000)
				}
			});
		}

		const orgId = userIds[0];
		const capA = userIds[1];
		const capB = userIds[6];
		const membersA = userIds.slice(1, 6);
		const membersB = userIds.slice(6, 11);

		const teamA = await db.team.create({
			data: {
				name: `MD Radiant ${run}`,
				tag: 'MDA',
				game: 'Dota 2',
				createdById: capA,
				members: {
					create: membersA.map((id, index) => ({
						userId: id,
						role: index === 0 ? 'captain' : 'member',
						confirmed: true,
						confirmedAt: new Date()
					}))
				}
			}
		});
		const teamB = await db.team.create({
			data: {
				name: `MD Dire ${run}`,
				tag: 'MDB',
				game: 'Dota 2',
				createdById: capB,
				members: {
					create: membersB.map((id, index) => ({
						userId: id,
						role: index === 0 ? 'captain' : 'member',
						confirmed: true,
						confirmedAt: new Date()
					}))
				}
			}
		});
		teamAId = teamA.id;
		teamBId = teamB.id;

		const now = new Date();
		const tournament = await db.tournament.create({
			data: {
				title: `Match Day QA ${run}`,
				description: 'E2E match-day: lobby + dual captain report',
				status: 'LIVE',
				format: 'SINGLE_ELIMINATION',
				maxTeams: 8,
				seriesRules: 'BO1',
				prizePool: 0,
				prizeStatus: 'NONE',
				startAt: new Date(now.getTime() - 60_000),
				checkInOpensAt: new Date(now.getTime() - 120_000),
				checkInClosesAt: new Date(now.getTime() - 30_000),
				createdById: orgId,
				staff: { create: { userId: orgId, role: 'OWNER' } },
				applications: {
					create: [
						{
							teamId: teamA.id,
							status: 'IN_BRACKET',
							seed: 1,
							checkedInAt: now,
							rosterSnapshot: membersA.map((id, index) => ({
								userId: id,
								displayName: `MD Player ${run} ${index + 1}`,
								steamId: String(steamBase + BigInt(index + 1))
							}))
						},
						{
							teamId: teamB.id,
							status: 'IN_BRACKET',
							seed: 2,
							checkedInAt: now,
							rosterSnapshot: membersB.map((id, index) => ({
								userId: id,
								displayName: `MD Player ${run} ${index + 6}`,
								steamId: String(steamBase + BigInt(index + 6))
							}))
						}
					]
				}
			}
		});
		tournamentId = tournament.id;

		const match = await db.match.create({
			data: {
				tournamentId: tournament.id,
				round: 1,
				position: 0,
				bracket: 'winners',
				bestOf: 1,
				status: 'SCHEDULED',
				teamAId: teamA.id,
				teamBId: teamB.id,
				reportDeadlineAt: new Date(now.getTime() + 2 * 60 * 60_000),
				startedAt: now
			}
		});
		matchId = match.id;

		const orgCtx = await sessionFor(0);
		const capACtx = await sessionFor(1);
		const capBCtx = await sessionFor(6);

		const me = await json(await capACtx.request.get('/api/me'));
		expect(me.user?.id).toBe(capA);

		const capAPage = await capACtx.newPage();
		await capAPage.goto(`/tournaments/${tournamentId}`);
		await expect(capAPage.getByRole('heading', { level: 1, name: `Match Day QA ${run}` })).toBeVisible();
		const matchBlock = capAPage.locator(`#match-${matchId}`);
		await expect(matchBlock).toBeVisible();
		await matchBlock.getByPlaceholder('Имя лобби').fill(`QA Lobby ${run}`);
		await matchBlock.getByPlaceholder('Пароль').fill('aegis1');
		await matchBlock.getByPlaceholder('Сервер, например EU West').fill('EU East');
		await matchBlock.getByPlaceholder(/Голосовой/).fill('https://discord.gg/aegis-qa');
		await matchBlock.getByRole('button', { name: 'Выложить лобби', exact: true }).click();
		await expect(matchBlock.getByText(`QA Lobby ${run}`)).toBeVisible({ timeout: 20000 });

		const reportA = await capACtx.request.post(`/api/matches/${matchId}/report`, {
			data: { scoreA: 1, scoreB: 0 },
			headers: { Origin: origin, 'Idempotency-Key': `md-a-${run}` }
		});
		expect(reportA.status(), await reportA.text()).toBe(200);
		expect((await reportA.json()).state).toBe('waiting');

		await capAPage.reload();
		await expect(capAPage.locator(`#match-${matchId}`)).toContainText(/Ждём счёт соперника|ожидан/i);

		const reportB = await capBCtx.request.post(`/api/matches/${matchId}/report`, {
			data: { scoreA: 1, scoreB: 0 },
			headers: { Origin: origin, 'Idempotency-Key': `md-b-${run}` }
		});
		expect(reportB.status(), await reportB.text()).toBe(200);
		expect((await reportB.json()).state).toBe('completed');

		const homePage = await capACtx.newPage();
		await homePage.goto('/home');
		await expect(homePage.locator('[data-home-desk]')).toBeVisible();
		await expect(homePage.locator('[data-home-desk]')).toContainText(/1\s*:\s*0/, { timeout: 8000 });

		await expect
			.poll(async () => (await db.match.findUniqueOrThrow({ where: { id: matchId } })).status)
			.toBe('COMPLETED');

		const settled = await db.match.findUniqueOrThrow({ where: { id: matchId } });
		expect(settled.scoreA).toBe(1);
		expect(settled.scoreB).toBe(0);
		expect(settled.winnerTeamId).toBe(teamAId);

		const orgPage = await orgCtx.newPage();
		await orgPage.goto(`/tournaments/${tournamentId}`);
		await expect(orgPage.getByRole('heading', { level: 1, name: `Match Day QA ${run}` })).toBeVisible();
		await expect(orgPage.locator(`#match-${matchId}`)).toContainText(/1\s*[:：\-]\s*0|заверш|COMPLETED|побед/i);
		await expect(orgPage.getByRole('heading', { name: 'Кто принят и кто ждёт' })).toBeVisible();
		await expect(orgPage.getByRole('button', { name: /Завершить кубок/ })).toBeVisible();

		const capBPage = await capBCtx.newPage();
		await capBPage.goto(`/tournaments/${tournamentId}#match-${matchId}`);
		await expect(capBPage.getByRole('heading', { level: 1, name: `Match Day QA ${run}` })).toBeVisible();
		await expect(capBPage.locator(`#match-${matchId}`)).toContainText(/1\s*[:：\-]\s*0|заверш/i);

		await capAPage.screenshot({ path: info.outputPath('match-day-captain.png'), scale: 'css' });
		await orgPage.screenshot({ path: info.outputPath('match-day-org.png'), scale: 'css' });
	} finally {
		for (const context of contexts) await context.close().catch(() => undefined);
		if (matchId) await db.matchReport.deleteMany({ where: { matchId } }).catch(() => undefined);
		if (matchId) await db.dispute.deleteMany({ where: { matchId } }).catch(() => undefined);
		if (matchId) await db.match.deleteMany({ where: { id: matchId } }).catch(() => undefined);
		if (tournamentId) {
			await db.teamApplication.deleteMany({ where: { tournamentId } }).catch(() => undefined);
			await db.tournamentStaff.deleteMany({ where: { tournamentId } }).catch(() => undefined);
			await db.tournament.deleteMany({ where: { id: tournamentId } }).catch(() => undefined);
		}
		if (teamAId) {
			await db.teamMember.deleteMany({ where: { teamId: teamAId } }).catch(() => undefined);
			await db.team.deleteMany({ where: { id: teamAId } }).catch(() => undefined);
		}
		if (teamBId) {
			await db.teamMember.deleteMany({ where: { teamId: teamBId } }).catch(() => undefined);
			await db.team.deleteMany({ where: { id: teamBId } }).catch(() => undefined);
		}
		if (userIds.length) {
			await db.session.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
			await db.notification.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
			await db.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
		}
		await db.$disconnect();
	}
});
