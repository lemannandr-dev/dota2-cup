import { prisma } from '@/lib/prisma';
import { isCupDryRun } from '@/lib/cup-label';
import type { RosterGap } from '@/lib/home-live';
import { countMainRoster } from '@/lib/team-roster';

export async function loadRosterGaps(userId: string): Promise<RosterGap[]> {
	const teams = await prisma.team.findMany({
		where: {
			deletedAt: null,
			OR: [{ createdById: userId }, { members: { some: { userId, role: 'captain', confirmed: true } } }]
		},
		select: {
			id: true,
			name: true,
			members: { select: { confirmed: true, isSubstitute: true, user: { select: { steamId: true, displayName: true } } } }
		}
	});
	if (!teams.length) return [];

	const apps = await prisma.teamApplication.findMany({
		where: {
			teamId: { in: teams.map((team) => team.id) },
			status: { notIn: ['REJECTED', 'WITHDRAWN', 'NO_CHECK_IN', 'DISQUALIFIED'] },
			tournament: { status: { in: ['REGISTRATION', 'CHECK_IN', 'LIVE'] } }
		},
		select: { teamId: true, tournament: { select: { id: true, title: true, status: true } } }
	});
	const cupByTeam = new Map(apps.map((app) => [app.teamId, app.tournament]));
	const openCups = await prisma.tournament.findMany({
		where: { scrimBoard: false, status: 'REGISTRATION' },
		orderBy: { startAt: 'asc' },
		select: { id: true, title: true }
	});
	const fallback = openCups.find((cup) => !isCupDryRun(cup.title)) ?? null;

	const gaps: RosterGap[] = [];
	for (const team of teams) {
		const roster = countMainRoster(team.members);
		const mains = team.members.filter((member) => member.confirmed && !member.isSubstitute);
		const withoutSteam = mains.filter((member) => !member.user.steamId).map((member) => member.user.displayName);
		const vacant = Math.max(0, 5 - mains.length);
		const extra = { withoutSteam, vacant };
		const active = cupByTeam.get(team.id);
		if (roster.ready && active) continue;
		if (!roster.ready) {
			const cup = active?.status === 'REGISTRATION' ? active : fallback;
			gaps.push({
				teamId: team.id,
				teamName: team.name,
				confirmed: roster.confirmed,
				withSteam: roster.withSteam,
				needed: roster.needed,
				readyToApply: false,
				tournamentId: cup?.id ?? null,
				tournamentTitle: cup?.title ?? null,
				...extra
			});
			continue;
		}
		if (!fallback) continue;
		gaps.push({
			teamId: team.id,
			teamName: team.name,
			confirmed: roster.confirmed,
			withSteam: roster.withSteam,
			needed: 0,
			readyToApply: true,
			tournamentId: fallback.id,
			tournamentTitle: fallback.title,
			...extra
		});
	}
	return gaps.sort((left, right) => Number(right.readyToApply) - Number(left.readyToApply) || right.needed - left.needed);
}
