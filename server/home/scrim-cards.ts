import { prisma } from '@/lib/prisma';
import { buildMatchRecap } from '@/lib/match-recap';
import { formatMoscowLabel } from '@/lib/datetime';
import type { HomeLiveCard } from '@/lib/home-live';

export async function loadScrimHomeCards(userId: string): Promise<HomeLiveCard[]> {
	const matches = await prisma.match.findMany({
		where: {
			scrim: true,
			OR: [{ teamA: { members: { some: { userId } } } }, { teamB: { members: { some: { userId } } } }]
		},
		orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
		take: 4,
		select: {
			id: true,
			status: true,
			scoreA: true,
			scoreB: true,
			bestOf: true,
			winnerTeamId: true,
			reportDeadlineAt: true,
			startedAt: true,
			createdAt: true,
			teamAId: true,
			teamBId: true,
			challenge: { select: { id: true } },
			teamA: { select: { id: true, name: true, logo: true, createdById: true, members: { where: { confirmed: true }, select: { userId: true, role: true } } } },
			teamB: { select: { id: true, name: true, logo: true, createdById: true, members: { where: { confirmed: true }, select: { userId: true, role: true } } } }
		}
	});

	const cards: HomeLiveCard[] = [];
	for (const match of matches) {
		const mine = match.teamA?.members.some((member) => member.userId === userId) || match.teamA?.createdById === userId ? match.teamA : match.teamB;
		const opponent = mine?.id === match.teamA?.id ? match.teamB : match.teamA;
		if (!mine || !match.challenge) continue;
		const isCaptain = mine.createdById === userId || mine.members.some((member) => member.userId === userId && member.role === 'captain');
		const closed = match.status === 'COMPLETED' || match.status === 'TECHNICAL';
		const href = `/teams?challenge=${match.challenge.id}`;
		const recap = closed
			? buildMatchRecap({
					matchId: match.id,
					status: match.status,
					scoreA: match.scoreA,
					scoreB: match.scoreB,
					winnerTeamId: match.winnerTeamId,
					teamId: mine.id,
					teamName: mine.name,
					opponentName: opponent?.name ?? null,
					finaleHint: 'Скрим закрыт. Приза нет. Рейтинг арены записан этой парой.'
				})
			: null;
		const startAt = match.startedAt ?? match.createdAt;
		cards.push({
			id: `scrim-${match.id}`,
			tournamentId: match.challenge.id,
			title: `Скрим · ${match.teamA?.name ?? 'A'} — ${match.teamB?.name ?? 'B'}`,
			href,
			startAt: startAt.toISOString(),
			startLabel: formatMoscowLabel(startAt),
			teamName: mine.name,
			teamLogo: mine.logo ?? null,
			teamA: match.teamA ? { id: match.teamA.id, name: match.teamA.name, logo: match.teamA.logo ?? null } : null,
			teamB: match.teamB ? { id: match.teamB.id, name: match.teamB.name, logo: match.teamB.logo ?? null } : null,
			scoreA: match.scoreA,
			scoreB: match.scoreB,
			bestOf: match.bestOf,
			matchId: match.id,
			matchStatus: match.status,
			tournamentStatus: 'LIVE',
			applicationStatus: 'IN_BRACKET',
			action: closed
				? { code: 'recap', label: recap?.ratingLabel ?? 'Скрим закрыт', hint: recap?.nextHint ?? 'Приза нет.' }
				: match.status === 'NEEDS_REVIEW'
					? { code: 'dispute', label: 'Спор скрима', hint: 'Капитаны сдали разный счёт. Приза у скрима нет.' }
					: { code: 'scrim', label: 'Соперник принял вызов', hint: 'Скрим без приза. Оба капитана сдают один счёт — арена +16/−12.' },
			channels: [],
			roster: [],
			isCaptain,
			opponentName: opponent?.name ?? null,
			opponentLogo: opponent?.logo ?? null,
			lobbyName: null,
			lobbyPassword: null,
			lobbyRegion: null,
			lobbyVoice: null,
			lobbyPlaying: false,
			recap,
			reportDeadlineLabel: match.reportDeadlineAt ? formatMoscowLabel(match.reportDeadlineAt) : null,
			prizePool: 0,
			prizeStatus: 'NONE',
			prizeCurrency: 'RUB'
		});
	}
	return cards;
}
