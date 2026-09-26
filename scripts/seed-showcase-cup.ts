/**
 * Витрина кубка на стенде: «Тестовая пятёрка Aegis» — чемпион.
 * Приз не резервируем. Нужен, чтобы показать кубок на /teams, /players и в профиле.
 */
import { prisma } from '../lib/prisma';

const TITLE = 'Витрина кубка Aegis 2026';
const WINNER_ID = 'cmt469szy00014ksh9as74wtj';
const RUNNER_ID = 'cmt46b9w60002cxq0jpoaiotc';
const ORG_ID = 'cmt397c1e00001536lgemhbrw';

async function rosterSnapshot(teamId: string) {
	const members = await prisma.teamMember.findMany({
		where: { teamId },
		include: { user: { select: { id: true, displayName: true, steamId: true } } },
		orderBy: { joinedAt: 'asc' }
	});
	return members.map((member) => ({
		userId: member.userId,
		displayName: member.user.displayName,
		steamId: member.user.steamId
	}));
}

async function upsertApplication(tournamentId: string, teamId: string, seed: number, snapshot: unknown) {
	const existing = await prisma.teamApplication.findUnique({
		where: { teamId_tournamentId: { teamId, tournamentId } }
	});
	if (existing) {
		return prisma.teamApplication.update({
			where: { id: existing.id },
			data: { status: 'IN_BRACKET', seed, rosterSnapshot: snapshot as object, checkedInAt: existing.checkedInAt ?? new Date() }
		});
	}
	return prisma.teamApplication.create({
		data: {
			teamId,
			tournamentId,
			status: 'IN_BRACKET',
			seed,
			rosterSnapshot: snapshot as object,
			checkedInAt: new Date()
		}
	});
}

async function main() {
	const [winner, runner, org] = await Promise.all([
		prisma.team.findUnique({ where: { id: WINNER_ID } }),
		prisma.team.findUnique({ where: { id: RUNNER_ID } }),
		prisma.user.findUnique({ where: { id: ORG_ID } })
	]);
	if (!winner || !runner || !org) {
		throw new Error('Нет команды-чемпиона, финалиста или организатора стенда');
	}

	const startAt = new Date('2026-08-25T12:00:00.000Z');
	const existing = await prisma.tournament.findFirst({ where: { title: TITLE } });
	const tournament =
		existing ??
		(await prisma.tournament.create({
			data: {
				title: TITLE,
				description:
					'Витрина стенда: как выглядит кубок после реального финала. Приз не резервировали — это показ гравировки, не выплата.',
				format: 'SINGLE_ELIMINATION',
				status: 'FINISHED',
				maxTeams: 8,
				seriesRules: 'BO1',
				region: 'EU East',
				prizePool: 0,
				prizeCurrency: 'RUB',
				prizeStatus: 'NONE',
				startAt,
				checkInOpensAt: new Date('2026-08-25T10:00:00.000Z'),
				checkInClosesAt: new Date('2026-08-25T11:30:00.000Z'),
				rules: 'Показательный финал для каталога команд и профилей. +16/−12 здесь не пишем.',
				createdById: org.id
			}
		}));

	if (existing) {
		await prisma.tournament.update({
			where: { id: existing.id },
			data: { status: 'FINISHED', prizePool: 0, prizeStatus: 'NONE' }
		});
	}

	const [winnerRoster, runnerRoster] = await Promise.all([rosterSnapshot(winner.id), rosterSnapshot(runner.id)]);
	await upsertApplication(tournament.id, winner.id, 1, winnerRoster);
	await upsertApplication(tournament.id, runner.id, 2, runnerRoster);

	const finalMatch = await prisma.match.findFirst({
		where: { tournamentId: tournament.id, nextMatchId: null }
	});
	const matchData = {
		round: 1,
		position: 0,
		bracket: 'winners',
		bestOf: 1,
		status: 'COMPLETED' as const,
		teamAId: winner.id,
		teamBId: runner.id,
		scoreA: 1,
		scoreB: 0,
		winnerTeamId: winner.id,
		nextMatchId: null,
		rosterA: winnerRoster as object,
		rosterB: runnerRoster as object,
		finishedAt: startAt
	};
	if (finalMatch) {
		await prisma.match.update({ where: { id: finalMatch.id }, data: matchData });
	} else {
		await prisma.match.create({ data: { tournamentId: tournament.id, ...matchData } });
	}

	console.log(
		JSON.stringify(
			{
				ok: true,
				tournamentId: tournament.id,
				href: `/tournaments/${tournament.id}`,
				winner: winner.name,
				players: winnerRoster.map((row) => row.displayName)
			},
			null,
			2
		)
	);
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
