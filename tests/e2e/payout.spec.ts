import { test, expect, type BrowserContext, type APIResponse } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { generateTotpSecret, totpCode } from '../../lib/totp';

/**
 * Stage-6 payout: escrow reserve + TOTP confirm after dual captain report.
 * Opt-in: AEGIS_E2E_MATCHDAY=1 or AEGIS_E2E_PARTY=1.
 */
test('payout: escrow reserve and TOTP pay after dual report', async ({ browser }, info) => {
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
	const steamBase = 76561199400000000n + BigInt(`0x${randomBytes(4).toString('hex')}`);
	const prize = 10_000;
	const totpSecret = generateTotpSecret();
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
					userId: `pay-${run}-${index}`,
					displayName: index === 0 ? `Pay Org ${run}` : `Pay Player ${run} ${index}`,
					steamId: String(steamBase + BigInt(index)),
					role: index === 0 ? 'ORGANIZER' : 'USER',
					balance: index === 0 ? prize * 2 : 0,
					totpSecret: index === 0 ? totpSecret : null,
					totpEnabledAt: index === 0 ? new Date() : null,
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
				name: `Pay Radiant ${run}`,
				tag: 'PRA',
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
				name: `Pay Dire ${run}`,
				tag: 'PRB',
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
				title: `Payout QA ${run}`,
				status: 'LIVE',
				format: 'SINGLE_ELIMINATION',
				maxTeams: 8,
				seriesRules: 'BO1',
				prizePool: prize,
				prizeStatus: 'UNCONFIRMED',
				startAt: now,
				checkInOpensAt: new Date(now.getTime() - 60_000),
				checkInClosesAt: new Date(now.getTime() + 60_000),
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
								displayName: `Pay Player ${run} ${index + 1}`,
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
								displayName: `Pay Player ${run} ${index + 6}`,
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
				tournamentId,
				round: 1,
				position: 0,
				bracket: 'winners',
				bestOf: 1,
				status: 'SCHEDULED',
				teamAId,
				teamBId,
				nextMatchId: null,
				reportDeadlineAt: new Date(now.getTime() + 2 * 60 * 60_000),
				startedAt: now
			}
		});
		matchId = match.id;

		const orgCtx = await sessionFor(0);
		const capACtx = await sessionFor(1);
		const capBCtx = await sessionFor(6);

		const code = totpCode(totpSecret);
		const reserved = await json(
			await orgCtx.request.post(`/api/tournaments/${tournamentId}/payouts`, {
				data: { reserve: true, totp: code },
				headers: { Origin: origin, 'Idempotency-Key': `pay-reserve-${run}` }
			})
		);
		expect(reserved.prizeStatus || reserved.reserved).toBeTruthy();
		expect(
			reserved.prizeStatus === 'CONFIRMED' || reserved.reserved === true
		).toBe(true);

		await expect
			.poll(async () => (await db.tournament.findUniqueOrThrow({ where: { id: tournamentId } })).prizeStatus)
			.toBe('CONFIRMED');

		await json(
			await capACtx.request.post(`/api/matches/${matchId}/report`, {
				data: { scoreA: 1, scoreB: 0 },
				headers: { Origin: origin, 'Idempotency-Key': `pay-a-${run}` }
			})
		);
		const reportB = await json(
			await capBCtx.request.post(`/api/matches/${matchId}/report`, {
				data: { scoreA: 1, scoreB: 0 },
				headers: { Origin: origin, 'Idempotency-Key': `pay-b-${run}` }
			})
		);
		expect(reportB.state).toBe('completed');

		await db.tournament.update({ where: { id: tournamentId }, data: { status: 'FINISHED' } });

		const payCode = totpCode(totpSecret);
		const paid = await json(
			await orgCtx.request.post(`/api/tournaments/${tournamentId}/payouts`, {
				data: { confirm: true, totp: payCode },
				headers: { Origin: origin, 'Idempotency-Key': `pay-confirm-${run}` }
			})
		);
		expect(paid.paid ?? paid.allocations ?? paid).toBeTruthy();

		const allocations = await db.prizeAllocation.findMany({
			where: { tournamentId },
			orderBy: { place: 'asc' }
		});
		expect(allocations.some((row) => row.status === 'PAID')).toBe(true);

		const replay = await json(
			await orgCtx.request.post(`/api/tournaments/${tournamentId}/payouts`, {
				data: { confirm: true, totp: totpCode(totpSecret) },
				headers: { Origin: origin, 'Idempotency-Key': `pay-confirm-${run}` }
			})
		);
		expect(replay).toBeTruthy();

		const page = await orgCtx.newPage();
		await page.goto(`/tournaments/${tournamentId}`);
		await expect(page.getByRole('heading', { level: 1, name: `Payout QA ${run}` })).toBeVisible();
		await page.screenshot({ path: info.outputPath('payout-org.png'), scale: 'css' });
	} finally {
		for (const context of contexts) await context.close().catch(() => undefined);
		if (matchId) {
			await db.dispute.deleteMany({ where: { matchId } }).catch(() => undefined);
			await db.matchReport.deleteMany({ where: { matchId } }).catch(() => undefined);
			await db.match.deleteMany({ where: { id: matchId } }).catch(() => undefined);
		}
		if (tournamentId) {
			await db.prizeAllocation.deleteMany({ where: { tournamentId } }).catch(() => undefined);
			await db.teamApplication.deleteMany({ where: { tournamentId } }).catch(() => undefined);
			await db.tournamentStaff.deleteMany({ where: { tournamentId } }).catch(() => undefined);
			await db.transaction.deleteMany({ where: { metadata: { path: ['tournamentId'], equals: tournamentId } } }).catch(() => undefined);
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
			await db.transaction.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
			await db.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
		}
		await db.$disconnect();
	}
});
