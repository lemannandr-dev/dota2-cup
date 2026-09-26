import { prisma } from '@/lib/prisma';

import { decideClosedCheckIn, SYSTEM_TICK_ACTOR } from '@/lib/tournament-tick-policy';

import { notifyTournamentDayReadiness } from '@/server/tournaments/readiness';

import { notifyCheckInOpened } from '@/server/tournaments/check-in-notify';

import { notifyMatchSoon } from '@/server/tournaments/match-soon-notify';

import { notifyPairSoon } from '@/server/tournaments/pair-soon-notify';

import { generateTournamentBracket } from '@/server/tournaments/generate-bracket';

import { stampOpenMatchDeadlines } from '@/server/matches/stamp-deadline';

import { noCheckInNotifyRows } from '@/lib/no-check-in-notify';

import { formatMoscowLabel } from '@/lib/datetime';

import { releasePrizeEscrow } from '@/server/prizes/escrow';

import { acquireLock, releaseLock } from '@/server/cache/redis';

import { TOURNAMENT_TICK_LOCK_KEY, withPgAdvisoryLock } from '@/server/db/advisory-lock';



let started = false;



const REDIS_TICK_LOCK = 'lock:tournament-tick';



async function closeExpiredCheckIn(now: Date) {

	const expiredCheckIn = await prisma.tournament.findMany({

		where: { status: 'CHECK_IN', checkInClosesAt: { lte: now } },

		select: { id: true, title: true, status: true, checkInClosesAt: true }

	});

	for (const tournament of expiredCheckIn) {

		const dropping = await prisma.teamApplication.findMany({

			where: { tournamentId: tournament.id, status: { in: ['SUBMITTED', 'APPROVED', 'NEEDS_ACTION'] } },

			select: {

				team: {

					select: {

						createdById: true,

						members: { where: { confirmed: true }, select: { userId: true } }

					}

				}

			}

		});

		await prisma.teamApplication.updateMany({

			where: { tournamentId: tournament.id, status: { in: ['SUBMITTED', 'APPROVED', 'NEEDS_ACTION'] } },

			data: { status: 'NO_CHECK_IN' }

		});

		const rows = noCheckInNotifyRows({

			tournamentId: tournament.id,

			title: tournament.title,

			closesLabel: formatMoscowLabel(tournament.checkInClosesAt),

			userIds: dropping.flatMap((app) => [app.team.createdById, ...app.team.members.map((member) => member.userId)])

		});

		if (rows.length) {

			await prisma.notification.createMany({ data: rows }).catch((error) => {

				console.error('no-check-in notify failed', tournament.id, error);

			});

		}



		const [existingMatchCount, checkedInCount] = await Promise.all([

			prisma.match.count({ where: { tournamentId: tournament.id } }),

			prisma.teamApplication.count({ where: { tournamentId: tournament.id, status: 'CHECKED_IN' } })

		]);

		const decision = decideClosedCheckIn({

			status: tournament.status,

			checkInClosesAt: tournament.checkInClosesAt,

			existingMatchCount,

			checkedInCount,

			now

		});

		if (decision === 'generate') {

			await generateTournamentBracket(tournament.id, SYSTEM_TICK_ACTOR).catch((error) => {

				console.error('auto-bracket failed', tournament.id, error);

			});

			continue;

		}

		if (decision === 'cancel') {

			await releasePrizeEscrow(tournament.id, SYSTEM_TICK_ACTOR).catch((error) => {

				console.error('escrow release on tick cancel failed', tournament.id, error);

			});

			await prisma.$transaction([

				prisma.tournament.update({

					where: { id: tournament.id },

					data: { status: 'CANCELLED' }

				}),

				prisma.auditLog.create({

					data: {

						actorId: SYSTEM_TICK_ACTOR,

						action: 'TOURNAMENT_CANCELLED_NO_TEAMS',

						entity: 'Tournament',

						entityId: tournament.id,

						payload: { checkedInCount, existingMatchCount }

					}

				})

			]);

		}

	}

}



async function runTournamentTickBody(now: Date) {

	const closing = await prisma.tournament.findMany({

		where: {

			status: 'REGISTRATION',

			OR: [{ checkInOpensAt: { lte: now } }, { startAt: { lte: now }, checkInOpensAt: null }]

		},

		select: { id: true }

	});

	if (closing.length) {

		const openedIds = closing.map((t) => t.id);

		await prisma.tournament.updateMany({

			where: { id: { in: openedIds } },

			data: { status: 'CHECK_IN' }

		});

		await notifyCheckInOpened(openedIds).catch((error) => {

			console.error('check-in notify failed', error);

		});

	}



	await closeExpiredCheckIn(now);



	const live = await prisma.tournament.findMany({

		where: { status: 'LIVE' },

		include: { matches: { select: { status: true } } }

	});

	for (const tournament of live) {

		await stampOpenMatchDeadlines(tournament.id, tournament.startAt, now);

		if (tournament.scrimBoard) continue;

		if (!tournament.matches.length) continue;

		const unfinished = tournament.matches.some((m) => !['COMPLETED', 'TECHNICAL'].includes(m.status));

		if (!unfinished) {

			await prisma.tournament.update({ where: { id: tournament.id }, data: { status: 'FINISHED' } });

		}

	}



	await notifyTournamentDayReadiness(now).catch((error) => {

		console.error('readiness notify failed', error);

	});

	await notifyMatchSoon(now).catch((error) => {

		console.error('match-soon notify failed', error);

	});

	await notifyPairSoon(now).catch((error) => {

		console.error('pair-soon notify failed', error);

	});

}



export async function runTournamentTick(now = new Date()) {

	const redisHeld = await acquireLock(REDIS_TICK_LOCK, 55);

	const ran = await withPgAdvisoryLock(TOURNAMENT_TICK_LOCK_KEY, () => runTournamentTickBody(now));

	if (redisHeld) await releaseLock(REDIS_TICK_LOCK);

	if (ran === null) return;

}



export function startTournamentTick(afterTick?: () => Promise<unknown>) {

	if (started || process.env.DISABLE_TOURNAMENT_TICK === '1') return;

	started = true;

	const intervalMs = Number(process.env.TOURNAMENT_TICK_MS || 60_000);

	const timer = setInterval(() => {

		runTournamentTick()

			.then(() => afterTick?.())

			.catch((error) => {

				console.error('tournament-tick failed', error);

			});

	}, intervalMs);

	if (process.env.TOURNAMENT_TICK_UNREF === '1') timer.unref();

}

