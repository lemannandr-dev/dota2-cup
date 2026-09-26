import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { TournamentLive } from '@/components/tournaments/TournamentLive';
import { WatchDesk } from '@/components/tournaments/WatchDesk';
import { MatchLobbyCard } from '@/components/tournaments/MatchLobbyCard';
import { getCurrentSteamUser } from '@/server/auth/session';
import { canPostMatchLobby, canViewMatchLobby, parseMatchLobby, publicMatchLobby } from '@/lib/match-lobby';
import { deputyIdFromMembers } from '@/lib/team-roles';
import { pickOpenMatch } from '@/lib/match-day';
import { isTournamentStaff } from '@/server/tournaments/staff';

export const dynamic = 'force-dynamic';

export default async function TournamentWatchPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const user = await getCurrentSteamUser();
	const tournament = await prisma.tournament.findUnique({
		where: { id },
		select: { id: true, title: true, status: true }
	});
	if (!tournament || tournament.status === 'DRAFT') notFound();

	let lobbyBlock: React.ReactNode = null;
	if (user) {
		const staff = await isTournamentStaff(user.id, user.role, tournament.id).catch(() => false);
		const matches = await prisma.match.findMany({
			where: {
				tournamentId: id,
				OR: [{ teamA: { members: { some: { userId: user.id } } } }, { teamB: { members: { some: { userId: user.id } } } }]
			},
			include: {
				teamA: { select: { createdById: true, members: { select: { userId: true, role: true, confirmed: true } } } },
				teamB: { select: { createdById: true, members: { select: { userId: true, role: true, confirmed: true } } } }
			}
		});
		const open = pickOpenMatch(matches);
		if (open) {
			const deputyA = open.teamA ? deputyIdFromMembers(open.teamA.members, open.teamA.createdById) : null;
			const deputyB = open.teamB ? deputyIdFromMembers(open.teamB.members, open.teamB.createdById) : null;
			const memberIds = [
				open.teamA?.createdById,
				open.teamB?.createdById,
				...(open.teamA?.members.map((member) => member.userId) ?? []),
				...(open.teamB?.members.map((member) => member.userId) ?? [])
			];
			const canSee = canViewMatchLobby(user.id, memberIds, staff);
			lobbyBlock = (
				<MatchLobbyCard
					matchId={open.id}
					lobby={publicMatchLobby(parseMatchLobby(open.lobby), canSee)}
					canPost={canPostMatchLobby(user.id, open.teamA?.createdById, open.teamB?.createdById, staff, deputyA, deputyB)}
					canSeeSecrets={canSee}
				/>
			);
		}
	}

	return (
		<main className="max-w-shell mx-auto space-y-6 px-4 py-10">
			<TournamentLive tournamentId={tournament.id} />
			<div>
				<Link href={`/tournaments/${tournament.id}`} className="text-xs text-aegisSoft">
					← Карточка турнира
				</Link>
				<h1 className="mt-2 font-display text-3xl text-cream">{tournament.title}</h1>
				<p className="mt-2 max-w-2xl text-sm text-muted">
					Как на мейджоре: стол справа/снизу, серия сверху. Это не GSI Valve — онлайн-счёт берётся из пары на арене.
				</p>
			</div>
			{lobbyBlock}
			<WatchDesk tournamentId={tournament.id} />
		</main>
	);
}
