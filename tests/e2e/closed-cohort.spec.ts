import { test, expect, type BrowserContext, type APIResponse } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';

/**
 * Stage-6 closed cohort: 5 players + 2 organizers on the same cup.
 * Opt-in: AEGIS_E2E_CLOSED=1 (or MATCHDAY/PARTY for CI reuse).
 */
test('closed cohort: 5 players + 2 organizers register, check-in, ready, dual-org desk', async ({ browser }, info) => {
	test.skip(
		process.env.AEGIS_E2E_CLOSED !== '1' &&
			process.env.AEGIS_E2E_MATCHDAY !== '1' &&
			process.env.AEGIS_E2E_PARTY !== '1',
		'Explicit local closed-cohort fixture'
	);
	test.setTimeout(240000);

	const db = new PrismaClient({
		datasourceUrl: 'postgresql://postgres:postgres@localhost:5434/mediagame?schema=public'
	});
	const run = randomBytes(4).toString('hex');
	const origin = 'http://localhost:3002';
	const steamBase = 76561199400000000n + BigInt(`0x${randomBytes(4).toString('hex')}`);
	const userIds: string[] = [];
	const tokens: string[] = [];
	const contexts: BrowserContext[] = [];
	let tournamentId = '';
	let teamId = '';

	async function json(response: APIResponse) {
		expect(response.ok(), await response.text()).toBe(true);
		return response.json();
	}

	async function sessionFor(index: number) {
		const context = await browser.newContext({
			baseURL: origin,
			viewport: info.project.use.viewport ?? { width: 393, height: 852 }
		});
		await context.addCookies([
			{ name: 'aegis_session', value: tokens[index], domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }
		]);
		contexts.push(context);
		return context;
	}

	try {
		// 0–1 organizers, 2–6 players (five)
		for (let index = 0; index < 7; index++) {
			const isOrg = index < 2;
			const user = await db.user.create({
				data: {
					userId: `cc-${run}-${index}`,
					displayName: isOrg ? `CC Org ${index + 1} ${run}` : `CC Player ${index - 1} ${run}`,
					steamId: String(steamBase + BigInt(index)),
					role: isOrg ? 'ORGANIZER' : 'USER',
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

		const ownerId = userIds[0];
		const staffId = userIds[1];
		const captainId = userIds[2];
		const playerIds = userIds.slice(2, 7);

		const team = await db.team.create({
			data: {
				name: `CC Squad ${run}`,
				tag: 'CCS',
				game: 'Dota 2',
				createdById: captainId,
				members: {
					create: playerIds.map((id, index) => ({
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
				title: `Closed Cohort ${run}`,
				status: 'CHECK_IN',
				format: 'SINGLE_ELIMINATION',
				maxTeams: 8,
				seriesRules: 'BO1',
				prizePool: 0,
				prizeStatus: 'NONE',
				startAt: new Date(now.getTime() + 60 * 60_000),
				checkInOpensAt: new Date(now.getTime() - 5 * 60_000),
				checkInClosesAt: new Date(now.getTime() + 2 * 60 * 60_000),
				createdById: ownerId,
				staff: {
					create: [
						{ userId: ownerId, role: 'OWNER' },
						{ userId: staffId, role: 'ADMIN' }
					]
				},
				applications: {
					create: {
						teamId,
						status: 'APPROVED',
						seed: 1,
						rosterSnapshot: playerIds.map((id, index) => ({
							userId: id,
							displayName: `CC Player ${index} ${run}`,
							steamId: String(steamBase + BigInt(index + 2))
						}))
					}
				}
			}
		});
		tournamentId = tournament.id;

		const ownerCtx = await sessionFor(0);
		const staffCtx = await sessionFor(1);
		const captainCtx = await sessionFor(2);
		const playerContexts = await Promise.all([3, 4, 5, 6].map((index) => sessionFor(index)));

		const checkIn = await json(
			await captainCtx.request.post(`/api/tournaments/${tournamentId}/check-in`, {
				data: { teamId },
				headers: { Origin: origin, 'Idempotency-Key': `cc-checkin-${run}` }
			})
		);
		expect(checkIn.application.status).toBe('CHECKED_IN');

		await db.tournament.update({ where: { id: tournamentId }, data: { status: 'LIVE', startAt: now } });
		await db.teamApplication.updateMany({
			where: { tournamentId, teamId },
			data: { status: 'IN_BRACKET' }
		});

		const ready = await json(
			await captainCtx.request.post(`/api/tournaments/${tournamentId}/ready`, {
				data: { teamId, ready: true },
				headers: { Origin: origin, 'Idempotency-Key': `cc-ready-${run}` }
			})
		);
		expect(ready.application).toBeTruthy();

		// Both organizers reach the cup desk (tournament staff, not stand-admin /admin)
		const ownerPage = await ownerCtx.newPage();
		await ownerPage.goto(`/tournaments/${tournamentId}`);
		await expect(ownerPage.getByRole('heading', { level: 1, name: `Closed Cohort ${run}` })).toBeVisible();
		await expect(ownerPage.locator('body')).toContainText(/CC Squad|CCS|заяв|состав|сетк|готов/i);

		const staffPage = await staffCtx.newPage();
		await staffPage.goto(`/tournaments/${tournamentId}`);
		await expect(staffPage.getByRole('heading', { level: 1, name: `Closed Cohort ${run}` })).toBeVisible();
		await expect(staffPage.locator('body')).toContainText(/CC Squad|CCS|заяв|состав|сетк|готов/i);

		// All five players open authenticated home (no guest Steam CTA)
		for (const context of [captainCtx, ...playerContexts]) {
			const page = await context.newPage();
			await page.goto('/home');
			await expect(page.getByRole('link', { name: /войти через steam/i })).toHaveCount(0);
			await expect(page.locator('main, body').first()).toBeVisible();
			await page.close();
		}

		await ownerPage.screenshot({ path: info.outputPath('closed-cohort-owner.png'), scale: 'css' });
		await staffPage.screenshot({ path: info.outputPath('closed-cohort-staff.png'), scale: 'css' });
	} finally {
		for (const context of contexts) await context.close().catch(() => undefined);
		if (tournamentId) {
			await db.teamApplication.deleteMany({ where: { tournamentId } }).catch(() => undefined);
			await db.tournamentStaff.deleteMany({ where: { tournamentId } }).catch(() => undefined);
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
