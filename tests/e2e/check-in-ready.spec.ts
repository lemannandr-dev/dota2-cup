import { test, expect, type BrowserContext, type APIResponse } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';

/**
 * Check-in + ready under aegis_session. Opt-in: AEGIS_E2E_MATCHDAY=1 or AEGIS_E2E_PARTY=1.
 */
test('check-in and ready: captain steam session, origin guard, idempotent replay', async ({ browser }, info) => {
	test.skip(
		process.env.AEGIS_E2E_MATCHDAY !== '1' && process.env.AEGIS_E2E_PARTY !== '1',
		'Explicit local fixture test only'
	);
	test.setTimeout(180000);

	const db = new PrismaClient({
		datasourceUrl: 'postgresql://postgres:postgres@localhost:5434/mediagame?schema=public'
	});
	const run = randomBytes(4).toString('hex');
	const origin = 'http://localhost:3002';
	const steamBase = 76561199200000000n + BigInt(`0x${randomBytes(4).toString('hex')}`);
	const userIds: string[] = [];
	const tokens: string[] = [];
	const contexts: BrowserContext[] = [];
	let tournamentId = '';
	let teamId = '';

	async function json(response: APIResponse) {
		expect(response.ok(), await response.text()).toBe(true);
		return response.json();
	}

	try {
		for (let index = 0; index < 6; index++) {
			const user = await db.user.create({
				data: {
					userId: `cr-${run}-${index}`,
					displayName: index === 0 ? `CR Org ${run}` : `CR Player ${run} ${index}`,
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
		const capId = userIds[1];
		const members = userIds.slice(1, 6);
		const team = await db.team.create({
			data: {
				name: `CR Five ${run}`,
				tag: 'CRF',
				game: 'Dota 2',
				createdById: capId,
				members: {
					create: members.map((id, index) => ({
						userId: id,
						role: index === 0 ? 'captain' : 'member',
						confirmed: true,
						confirmedAt: new Date()
					}))
				}
			}
		});
		teamId = team.id;

		const now = new Date();
		const tournament = await db.tournament.create({
			data: {
				title: `Check Ready QA ${run}`,
				status: 'CHECK_IN',
				format: 'SINGLE_ELIMINATION',
				maxTeams: 8,
				seriesRules: 'BO1',
				prizePool: 0,
				prizeStatus: 'NONE',
				startAt: new Date(now.getTime() + 30 * 60_000),
				checkInOpensAt: new Date(now.getTime() - 10 * 60_000),
				checkInClosesAt: new Date(now.getTime() + 60 * 60_000),
				createdById: orgId,
				staff: { create: { userId: orgId, role: 'OWNER' } },
				applications: {
					create: {
						teamId: team.id,
						status: 'APPROVED',
						seed: 1,
						rosterSnapshot: members.map((id, index) => ({
							userId: id,
							displayName: `CR Player ${run} ${index + 1}`,
							steamId: String(steamBase + BigInt(index + 1))
						}))
					}
				}
			}
		});
		tournamentId = tournament.id;

		const capCtx = await browser.newContext({
			baseURL: origin,
			viewport: info.project.use.viewport ?? { width: 1440, height: 1000 }
		});
		contexts.push(capCtx);
		await capCtx.addCookies([
			{ name: 'aegis_session', value: tokens[1], domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }
		]);

		expect(
			(
				await capCtx.request.post(`/api/tournaments/${tournamentId}/check-in`, {
					data: { teamId },
					headers: { Origin: 'https://foreign.example' }
				})
			).status()
		).toBe(403);

		const idem = `checkin-${run}`;
		const first = await json(
			await capCtx.request.post(`/api/tournaments/${tournamentId}/check-in`, {
				data: { teamId },
				headers: { Origin: origin, 'Idempotency-Key': idem }
			})
		);
		expect(first.application.status).toBe('CHECKED_IN');

		const replay = await json(
			await capCtx.request.post(`/api/tournaments/${tournamentId}/check-in`, {
				data: { teamId },
				headers: { Origin: origin, 'Idempotency-Key': idem }
			})
		);
		expect(replay.application.status).toBe('CHECKED_IN');

		await db.tournament.update({ where: { id: tournamentId }, data: { status: 'LIVE', startAt: now } });
		await db.teamApplication.updateMany({
			where: { tournamentId, teamId },
			data: { status: 'IN_BRACKET' }
		});

		const readyIdem = `ready-${run}`;
		const ready = await json(
			await capCtx.request.post(`/api/tournaments/${tournamentId}/ready`, {
				data: { teamId, ready: true },
				headers: { Origin: origin, 'Idempotency-Key': readyIdem }
			})
		);
		expect(ready.application).toBeTruthy();

		const readyReplay = await json(
			await capCtx.request.post(`/api/tournaments/${tournamentId}/ready`, {
				data: { teamId, ready: true },
				headers: { Origin: origin, 'Idempotency-Key': readyIdem }
			})
		);
		expect(readyReplay.application).toBeTruthy();

		const page = await capCtx.newPage();
		await page.goto(`/tournaments/${tournamentId}`);
		await expect(page.getByRole('heading', { level: 1, name: `Check Ready QA ${run}` })).toBeVisible();
		await expect(page.getByText(/готов|READY|подтвержд/i).first()).toBeVisible();
		await page.screenshot({ path: info.outputPath('check-in-ready.png'), scale: 'css' });
	} finally {
		for (const context of contexts) await context.close().catch(() => undefined);
		if (tournamentId) {
			await db.notification.deleteMany({ where: { linkUrl: { contains: tournamentId } } }).catch(() => undefined);
			await db.teamApplication.deleteMany({ where: { tournamentId } }).catch(() => undefined);
			await db.tournamentStaff.deleteMany({ where: { tournamentId } }).catch(() => undefined);
			await db.auditLog.deleteMany({ where: { entityId: tournamentId } }).catch(() => undefined);
			await db.tournament.deleteMany({ where: { id: tournamentId } }).catch(() => undefined);
		}
		if (teamId) {
			await db.teamMember.deleteMany({ where: { teamId } }).catch(() => undefined);
			await db.team.deleteMany({ where: { id: teamId } }).catch(() => undefined);
		}
		if (userIds.length) {
			await db.session.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
			await db.notification.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
			await db.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
		}
		await db.$disconnect();
	}
});
