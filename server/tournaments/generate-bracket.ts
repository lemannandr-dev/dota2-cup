import { prisma } from '@/lib/prisma';
import { generateSingleElimination } from '@/lib/bracket';
import { generateDoubleElimination } from '@/lib/bracket-double';
import { seriesBestOf } from '@/lib/bracket-pure';
import { shouldSkipBracketGeneration } from '@/lib/concurrency-policy';
import { DomainError } from '@/server/errors';
import { stampOpenMatchDeadlines } from '@/server/matches/stamp-deadline';
import { lockTournamentRow } from '@/server/db/advisory-lock';

export async function generateTournamentBracket(tournamentId: string, actorId: string) {
	const matchCount = await prisma.$transaction(async (db) => {
		await lockTournamentRow(db, tournamentId);

		const tournament = await db.tournament.findUnique({
			where: { id: tournamentId },
			include: { applications: { where: { status: 'CHECKED_IN' }, orderBy: { createdAt: 'asc' } } }
		});
		if (!tournament) throw new DomainError('Турнир не найден', 404);
		if (tournament.status !== 'CHECK_IN') {
			throw new DomainError('Сетку можно собрать только в окне check-in', 400);
		}

		const existingMatchCount = await db.match.count({ where: { tournamentId } });
		if (shouldSkipBracketGeneration(existingMatchCount)) {
			throw new DomainError('Сетка уже собрана', 400);
		}
		if (tournament.applications.length < 2) {
			throw new DomainError('Нужно минимум 2 команды с check-in', 400);
		}

		const bestOf = seriesBestOf(tournament.seriesRules);
		const teams = tournament.applications.map((a, i) => ({ teamId: a.teamId, seed: a.seed ?? i + 1 }));
		const created =
			tournament.format === 'DOUBLE_ELIMINATION'
				? await generateDoubleElimination(tournamentId, teams, bestOf, db)
				: await generateSingleElimination(tournamentId, teams, bestOf, db);

		await db.tournament.update({ where: { id: tournamentId }, data: { status: 'LIVE' } });
		await db.teamApplication.updateMany({
			where: { tournamentId, status: 'CHECKED_IN' },
			data: { status: 'IN_BRACKET' }
		});
		await db.auditLog.create({
			data: { actorId, action: 'BRACKET_GENERATED', entity: 'Tournament', entityId: tournamentId, payload: { matchCount: created } }
		});

		return created;
	});

	await stampOpenMatchDeadlines(tournamentId, (await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { startAt: true } }))!.startAt);

	return { matchCount };
}
