import { ApplicationStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DomainError } from '@/server/errors';
import { applicationReviewNotifyRows, type ApplicationReviewStatus } from '@/lib/application-review-notify';

const allowed: ApplicationStatus[] = ['APPROVED', 'REJECTED', 'NEEDS_ACTION'];

export async function reviewApplication(
	tournamentId: string,
	applicationId: string,
	actorId: string,
	status: ApplicationStatus,
	note?: string | null
) {
	if (!allowed.includes(status)) throw new DomainError('Недопустимое решение', 400);
	const application = await prisma.teamApplication.findFirst({
		where: { id: applicationId, tournamentId },
		include: {
			tournament: { select: { id: true, title: true } },
			team: {
				select: {
					createdById: true,
					members: { where: { confirmed: true }, select: { userId: true } }
				}
			}
		}
	});
	if (!application) throw new DomainError('Заявка не найдена', 404);
	if (!['SUBMITTED', 'NEEDS_ACTION', 'APPROVED'].includes(application.status)) {
		throw new DomainError(`Заявку в статусе ${application.status} нельзя пересмотреть`, 400);
	}

	const trimmedNote = note?.trim() || null;
	const updated = await prisma.teamApplication.update({
		where: { id: application.id },
		data: { status }
	});
	await prisma.auditLog.create({
		data: {
			actorId,
			action: 'APPLICATION_REVIEWED',
			entity: 'TeamApplication',
			entityId: application.id,
			payload: { status, note: trimmedNote }
		}
	});

	const rows = applicationReviewNotifyRows({
		tournamentId: application.tournament.id,
		title: application.tournament.title,
		status: status as ApplicationReviewStatus,
		userIds: [application.team.createdById, ...application.team.members.map((member) => member.userId)],
		note: trimmedNote
	});
	if (rows.length) {
		await prisma.notification.createMany({ data: rows }).catch((error) => {
			console.error('application review notify failed', application.id, error);
		});
	}
	return updated;
}
