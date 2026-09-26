import { prisma } from '@/lib/prisma';
import { computeReportDeadline } from '@/lib/match-deadline';

export async function stampOpenMatchDeadlines(tournamentId: string, startAt: Date, now = new Date()) {
	const deadline = computeReportDeadline(now, startAt);
	await prisma.match.updateMany({
		where: {
			tournamentId,
			reportDeadlineAt: null,
			status: 'SCHEDULED',
			teamAId: { not: null },
			teamBId: { not: null }
		},
		data: { reportDeadlineAt: deadline }
	});
}
