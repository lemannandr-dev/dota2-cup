import { prisma } from '@/lib/prisma';
import { DomainError } from '@/server/errors';
import { canPromoteWaitlist, countedApplicationStatus } from '@/lib/waitlist';

export async function promoteWaitlistApplication(tournamentId: string, applicationId: string, actorId: string) {
	const application = await prisma.teamApplication.findFirst({
		where: { id: applicationId, tournamentId },
		include: { tournament: { select: { id: true, status: true, maxTeams: true, applications: { select: { status: true } } } } }
	});
	if (!application) throw new DomainError('Заявка не найдена', 404);
	const counted = application.tournament.applications.filter((row) => countedApplicationStatus(row.status)).length;
	if (
		!canPromoteWaitlist({
			counted,
			maxTeams: application.tournament.maxTeams,
			applicationStatus: application.status,
			tournamentStatus: application.tournament.status
		})
	) {
		throw new DomainError('Пока нет свободного слота или заявка не в листе ожидания', 400);
	}
	const updated = await prisma.teamApplication.update({
		where: { id: application.id },
		data: { status: 'SUBMITTED' }
	});
	await prisma.auditLog.create({
		data: {
			actorId,
			action: 'WAITLIST_PROMOTED',
			entity: 'TeamApplication',
			entityId: application.id
		}
	});
	return updated;
}
