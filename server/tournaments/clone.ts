import { prisma } from '@/lib/prisma';
import { DomainError } from '@/server/errors';
import { ensureOwnerStaff } from '@/server/tournaments/staff';

export async function cloneTournamentDraft(sourceId: string, actorId: string) {
	const source = await prisma.tournament.findUnique({ where: { id: sourceId } });
	if (!source) throw new DomainError('Турнир не найден', 404);
	const week = 7 * 24 * 60 * 60_000;
	const startAt = new Date(source.startAt.getTime() + week);
	const shift = (value: Date | null) => (value ? new Date(value.getTime() + week) : null);
	const copy = await prisma.tournament.create({
		data: {
			title: source.title.startsWith('Копия: ') ? source.title : `Копия: ${source.title}`,
			description: source.description,
			format: source.format,
			maxTeams: source.maxTeams,
			seriesRules: source.seriesRules,
			region: source.region,
			rankCap: source.rankCap,
			prizePool: source.prizePool,
			prizeCurrency: source.prizeCurrency,
			prizeStatus: 'UNCONFIRMED',
			checkInOpensAt: shift(source.checkInOpensAt),
			checkInClosesAt: shift(source.checkInClosesAt),
			startAt,
			rules: source.rules,
			broadcast: source.broadcast ?? undefined,
			status: 'DRAFT',
			createdById: actorId
		}
	});
	await ensureOwnerStaff(copy.id, actorId, 'OWNER').catch(() => undefined);
	await prisma.auditLog.create({
		data: {
			actorId,
			action: 'TOURNAMENT_CLONED',
			entity: 'Tournament',
			entityId: copy.id,
			payload: { sourceId, prizeStatus: 'UNCONFIRMED' }
		}
	});
	return copy;
}
