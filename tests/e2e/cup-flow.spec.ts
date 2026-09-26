import { test, expect, type BrowserContext, type APIResponse } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';

/**
 * Stage-6 slice: register → conflicting reports/dispute → org force result.
 * Opt-in: AEGIS_E2E_MATCHDAY=1 or AEGIS_E2E_PARTY=1.
 */
test('cup flow: register, dispute scores, org force result', async ({ browser }, info) => {
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
	const steamBase = 76561199300000000n + BigInt(`0x${randomBytes(4).toString('hex')}`);
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
					userId: `cf-${run}-${index}`,
					displayName: index === 0 ? `CF Org ${run}` : `CF Player ${run} ${index}`,
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
				name: `CF Radiant ${run}`,
				tag: 'CFA',
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
				name: `CF Dire ${run}`,
				tag: 'CFB',
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
				title: `Cup Flow QA ${run}`,
				status: 'REGISTRATION',
				format: 'SINGLE_ELIMINATION',
				maxTeams: 8,
				seriesRules: 'BO1',
				prizePool: 0,
				prizeStatus: 'NONE',
				startAt: new Date(now.getTime() + 60 * 60_000),
				checkInOpensAt: new Date(now.getTime() - 5 * 60_000),
				checkInClosesAt: new Date(now.getTime() + 2 * 60 * 60_000),
				createdById: orgId,
				staff: { create: { userId: orgId, role: 'OWNER' } }
			}
		});
		tournamentId = tournament.id;

		const orgCtx = await sessionFor(0);
		const capACtx = await sessionFor(1);
		const capBCtx = await sessionFor(6);

		const regA = await json(
			await capACtx.request.post(`/api/tournaments/${tournamentId}/register`, {
				data: { teamId: teamAId },
				headers: { Origin: origin }
			})
		);
		expect(regA.application.status).toBe('SUBMITTED');

		const regB = await json(
			await capBCtx.request.post(`/api/tournaments/${tournamentId}/register`, {
				data: { teamId: teamBId },
				headers: { Origin: origin }
			})
		);
		expect(regB.application.status).toBe('SUBMITTED');

		await db.teamApplication.updateMany({
			where: { tournamentId },
			data: { status: 'IN_BRACKET', checkedInAt: now }
		});
		await db.tournament.update({
			where: { id: tournamentId },
			data: { status: 'LIVE', startAt: now }
		});

		const match = await db.match.create({
			data: {
				tournamentId,
				round: 1,
				position: 0,
				bracket: 'winners',
				bestOf: 1,
				status: 'SCHEDULED',
				teamAId,
				teamBId,
				reportDeadlineAt: new Date(now.getTime() + 2 * 60 * 60_000),
				startedAt: now
			}
		});
		matchId = match.id;

		const reportA = await json(
			await capACtx.request.post(`/api/matches/${matchId}/report`, {
				data: { scoreA: 1, scoreB: 0 },
				headers: { Origin: origin, 'Idempotency-Key': `cf-a-${run}` }
			})
		);
		expect(reportA.state).toBe('waiting');

		const reportB = await json(
			await capBCtx.request.post(`/api/matches/${matchId}/report`, {
				data: { scoreA: 0, scoreB: 1 },
				headers: { Origin: origin, 'Idempotency-Key': `cf-b-${run}` }
			})
		);
		expect(reportB.state).toBe('dispute');

		await expect
			.poll(async () => (await db.match.findUniqueOrThrow({ where: { id: matchId } })).status)
			.toBe('NEEDS_REVIEW');

		const openDispute = await db.dispute.findFirst({
			where: { matchId, status: { in: ['OPEN', 'IN_REVIEW'] } }
		});
		expect(openDispute).toBeTruthy();

		const resolved = await json(
			await orgCtx.request.put(`/api/matches/${matchId}/disputes`, {
				data: {
					disputeId: openDispute!.id,
					status: 'RESOLVED',
					resolution: `Cup-flow QA: счёт 1:0 в пользу команды A`
				},
				headers: { Origin: origin }
			})
		);
		expect(resolved.dispute.status).toBe('RESOLVED');

		const forced = await json(
			await orgCtx.request.post(`/api/matches/${matchId}/result`, {
				data: { scoreA: 1, scoreB: 0 },
				headers: { Origin: origin }
			})
		);
		expect(forced.match.status).toBe('COMPLETED');
		expect(forced.match.winnerTeamId).toBe(teamAId);

		const page = await orgCtx.newPage();
		await page.goto(`/tournaments/${tournamentId}`);
		await expect(page.getByRole('heading', { level: 1, name: `Cup Flow QA ${run}` })).toBeVisible();
		await expect(page.locator(`#match-${matchId}`)).toContainText(/1\s*[:：\-]\s*0|заверш/i);
		await page.screenshot({ path: info.outputPath('cup-flow-org.png'), scale: 'css' });
	} finally {
		for (const context of contexts) await context.close().catch(() => undefined);
		if (matchId) {
			await db.dispute.deleteMany({ where: { matchId } }).catch(() => undefined);
			await db.matchReport.deleteMany({ where: { matchId } }).catch(() => undefined);
			await db.match.deleteMany({ where: { id: matchId } }).catch(() => undefined);
		}
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
