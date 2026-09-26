import { prisma } from '@/lib/prisma';
import { detectTeamCover, teamCoverLimit } from '@/lib/team-cover';
import { DomainError } from '@/server/errors';
import { normalizeTeamImage, preferredTeamCoverStorage, storeTeamCover } from '@/server/storage/team-cover';

export async function saveTeamCover(input: {
	actorId: string;
	teamId: string;
	slot: 'logo' | 'cover';
	bytes: Buffer;
}) {
	const detected = detectTeamCover(input.bytes);
	if (!detected) throw new DomainError('Нужен PNG, JPEG, WebP, GIF, MP4 или WebM');
	if (input.bytes.length > teamCoverLimit(detected.kind)) {
		throw new DomainError(detected.kind === 'video' ? 'Видео больше 8 МБ' : 'Картинка больше 4 МБ');
	}
	if (input.slot === 'logo' && detected.kind === 'video') {
		throw new DomainError('Знак команды — картинка или GIF, не видео');
	}

	const team = await prisma.team.findFirst({
		where: {
			id: input.teamId,
			deletedAt: null,
			OR: [
				{ createdById: input.actorId },
				{ members: { some: { userId: input.actorId, role: 'captain', confirmed: true } } }
			]
		},
		select: { id: true }
	});
	if (!team) throw new DomainError('Обложку может загрузить только лидер команды', 403);

	const storage = preferredTeamCoverStorage();
	const stored =
		detected.kind === 'image'
			? await storeTeamCover({
					teamId: team.id,
					bytes: await normalizeTeamImage(input.bytes, input.slot, detected),
					contentType: 'image/webp',
					extension: 'webp',
					storage
				})
			: await storeTeamCover({
					teamId: team.id,
					bytes: input.bytes,
					contentType: detected.contentType,
					extension: detected.extension === 'mp4' ? 'mp4' : 'webm',
					storage
				});

	const data =
		input.slot === 'logo'
			? { logo: stored.url }
			: detected.kind === 'video'
				? { videoUrl: stored.url, bannerUrl: null }
				: { bannerUrl: stored.url, videoUrl: null };

	const updated = await prisma.team.update({ where: { id: team.id }, data, select: { logo: true, bannerUrl: true, videoUrl: true } });
	await prisma.auditLog.create({
		data: {
			actorId: input.actorId,
			action: 'TEAM_COVER_UPLOADED',
			entity: 'Team',
			entityId: team.id,
			payload: { slot: input.slot, kind: detected.kind, key: stored.key }
		}
	});
	return updated;
}
