import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/server/auth/session';
import { isTournamentStaff, loadStaffActor } from '@/server/tournaments/staff';
import { canAssignTournamentReferee } from '@/lib/staff-policy';
import { RefereeDesk } from '@/components/tournaments/RefereeDesk';
import { isReservedTournamentSlug } from '@/server/tournaments/slugs';
import { CreateTournamentScreen } from '@/components/tournaments/CreateTournamentScreen';
import { TournamentActions } from '@/components/tournaments/TournamentActions';
import { TournamentLive } from '@/components/tournaments/TournamentLive';
import { ApplicationPipeline } from '@/components/tournaments/ApplicationPipeline';
import { MatchReadyBoard } from '@/components/tournaments/MatchReadyBoard';
import { PayoutConfirmPanel } from '@/components/tournaments/PayoutConfirmPanel';
import { EscrowPayoutMobileStrip } from '@/components/tournaments/EscrowPayoutMobileStrip';
import { buildPayoutPreview, describeEscrowWallet, formatPrizeAmount, pickFinalMatch, placeTeamsFromFinal } from '@/lib/prize-places';
import { TournamentEditForm } from '@/components/tournaments/TournamentEditForm';
import { canEditTournamentFields } from '@/lib/tournament-edit';
import { disputeSlaLabel, isDisputeStale } from '@/lib/dispute-sla';
import { StatusPill } from '@/components/dota/StatusPill';
import { formatCopy, tournamentStatusCopy } from '@/lib/tournament-copy';
import { readReadiness } from '@/server/tournaments/readiness';
import { rosterFromSnapshot } from '@/lib/match-day';
import { displayedRoster, pairBlocksRosterSwap, reportedTeamIdsOf } from '@/lib/roster-swap';
import { RosterSwapForm } from '@/components/tournaments/RosterSwapForm';
import { formatMoscowLabel } from '@/lib/datetime';
import { isCupDryRun, isCupShowcase } from '@/lib/cup-label';
import { landingPrizeKind, prizeHonestyHint } from '@/lib/landing-live';
import { parseBroadcast } from '@/lib/broadcast';
import { BroadcastDesk } from '@/components/tournaments/BroadcastDesk';
import { canPostMatchLobby, canViewMatchLobby, parseMatchLobby, publicMatchLobby } from '@/lib/match-lobby';
import { buildReadyCheck, playersForReadyStrip } from '@/lib/ready-check';
import { medalCaption, rankMedalFromTier, storedOpenDotaMmr, formatOpenDotaMmrCompact } from '@/lib/dota-rank';
import { buildCupTrophy } from '@/lib/cup-trophy';
import { CupTrophy } from '@/components/tournaments/CupTrophy';
import { PrizeRosterCard } from '@/components/tournaments/PrizeRosterCard';
import { deputyIdFromMembers, rosterBadge } from '@/lib/team-roles';
import { canNominateReferee, canVoteReferee, pickBallotLeader, refereeRatingLabel } from '@/lib/referee-ballot';
import { captainTeamId, listKnownReferees, listRefereeNominations } from '@/server/tournaments/referee-ballot';
import { TournamentPullRefresh } from '@/components/tournaments/TournamentPullRefresh';
import { StickyActionBar } from '@/components/ui/StickyActionBar';
import { nextStaffCupAction } from '@/lib/staff-cup-next';

export const dynamic = 'force-dynamic';

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const user = await getCurrentSteamUser();
	if (id === 'new' || id === 'create' || isReservedTournamentSlug(id)) {
		return <CreateTournamentScreen signedIn={Boolean(user)} />;
	}

	const teamInclude = {
		members: {
			include: {
				user: {
					select: {
						id: true,
						displayName: true,
						avatarUrl: true,
						steamId: true,
						rating: true,
						openDotaRankTier: true,
						openDotaLeaderboard: true,
						openDotaMmr: true,
						openDotaMmrSource: true
					}
				}
			}
		}
	};
	const tournament = await prisma.tournament.findUnique({
		where: { id },
		include: {
			applications: {
				orderBy: [{ seed: 'asc' }, { createdAt: 'asc' }],
				include: { team: { include: teamInclude } }
			},
			matches: {
				orderBy: [{ bracket: 'asc' }, { round: 'asc' }, { position: 'asc' }],
				include: {
					teamA: { include: teamInclude },
					teamB: { include: teamInclude },
					reports: { select: { teamId: true } },
					disputes: { orderBy: { createdAt: 'desc' } }
				}
			},
			prizeAllocations: true
		}
	});
	if (!tournament || tournament.scrimBoard) notFound();

	let staff = false;
	if (user) {
		try {
			staff = await isTournamentStaff(user.id, user.role, tournament.id);
		} catch {
			staff = tournament.createdById === user.id || user.role === 'ADMIN';
		}
	}
	if (tournament.status === 'DRAFT' && !staff) notFound();

	const staffDesk = await prisma.tournament.findUnique({
		where: { id: tournament.id },
		select: {
			createdById: true,
			staff: {
				select: {
					role: true,
					user: { select: { id: true, displayName: true, steamId: true, avatarUrl: true, rating: true, ratingGames: true } }
				}
			}
		}
	});
	const staffActor = staff && user ? await loadStaffActor(user.id, user.role, tournament.id) : null;
	const canManageStaff = Boolean(staffActor && canAssignTournamentReferee(staffActor.actor));
	const staffRows = (staffDesk?.staff ?? []).map((row) => ({
		userId: row.user.id,
		displayName: row.user.displayName,
		steamId: row.user.steamId,
		avatarUrl: row.user.avatarUrl,
		role: row.role,
		isOwner: row.user.id === staffDesk?.createdById,
		ratingLabel: refereeRatingLabel(row.user.rating, row.user.ratingGames)
	}));
	const captainOfTeamId = user ? await captainTeamId(tournament.id, user.id) : null;
	const [knownRefereeRows, nominationRows] = await Promise.all([
		listKnownReferees(staffRows.map((row) => row.userId)),
		listRefereeNominations(tournament.id)
	]);
	const nominationViews = nominationRows.map((row) => ({
		id: row.id,
		userId: row.nominee.id,
		displayName: row.nominee.displayName,
		steamId: row.nominee.steamId,
		avatarUrl: row.nominee.avatarUrl,
		ratingLabel: refereeRatingLabel(row.nominee.rating, row.nominee.ratingGames),
		teamName: row.team.name,
		proposedBy: row.proposedBy.displayName,
		votes: row.votes.length,
		mine: Boolean(captainOfTeamId && row.votes.some((vote) => vote.teamId === captainOfTeamId))
	}));
	const ballotLeaderId = pickBallotLeader(nominationViews.map((row) => ({ id: row.id, votes: row.votes })))?.id ?? null;
	const captainHere = Boolean(captainOfTeamId);
	const organizerBalance = tournament.createdById
		? (
				await prisma.user.findUnique({
					where: { id: tournament.createdById },
					select: { balance: true }
				})
			)?.balance ?? 0
		: 0;
	const staffInbox = (tournament.matches ?? [])
		.filter((match) => match.status === 'NEEDS_REVIEW' || ('disputes' in match && match.disputes.some((row) => ['OPEN', 'IN_REVIEW'].includes(row.status))))
		.map((match) => {
			const openDispute = 'disputes' in match ? match.disputes.find((row) => ['OPEN', 'IN_REVIEW'].includes(row.status)) : null;
			const openedAt = openDispute?.createdAt ?? match.updatedAt ?? new Date();
			return {
				matchId: match.id,
				href: `#match-${match.id}`,
				teamA: match.teamA?.name ?? 'Команда A',
				teamB: match.teamB?.name ?? 'Команда B',
				score: `${match.scoreA}:${match.scoreB}`,
				reason: openDispute?.reason ?? 'NEEDS_REVIEW',
				openedAt: openedAt instanceof Date ? openedAt.toISOString() : String(openedAt),
				ageLabel: disputeSlaLabel(openedAt),
				stale: isDisputeStale(openedAt)
			};
		});

	const myTeams = user
		? await prisma.team.findMany({
				where: {
					deletedAt: null,
					OR: [
						{ createdById: user.id },
						{ members: { some: { userId: user.id, role: 'captain', confirmed: true } } }
					]
				},
				include: { members: { where: { confirmed: true, isSubstitute: false }, select: { user: { select: { steamId: true } } } } }
			})
		: [];

	const teamBoard = Object.fromEntries(
		tournament.applications.map((app) => [
			app.teamId,
			{
				readyStatus: readReadiness(app.rosterSnapshot).status,
				snapshot: app.rosterSnapshot
			}
		])
	);

	const swapTargets = tournament.applications
		.filter((app) => ['CHECKED_IN', 'IN_BRACKET'].includes(app.status))
		.filter((app) => staff || app.team.createdById === user?.id)
		.map((app) => {
			const current = rosterFromSnapshot(app.rosterSnapshot).filter(
				(player): player is { userId: string; displayName: string } => Boolean(player.userId)
			);
			const onRoster = new Set(current.map((player) => player.userId));
			const bench = app.team.members
				.filter((member) => member.confirmed && member.user.steamId && !onRoster.has(member.user.id))
				.map((member) => ({ userId: member.user.id, displayName: member.user.displayName }));
			const locked = tournament.matches.some((match) =>
				pairBlocksRosterSwap(
					{
						status: match.status,
						teamAId: match.teamAId,
						teamBId: match.teamBId,
						reportedTeamIds: reportedTeamIdsOf(match),
						frozenA: Boolean(match.rosterA),
						frozenB: Boolean(match.rosterB)
					},
					app.teamId
				)
			);
			return { teamId: app.teamId, teamName: app.team.name, current, bench, locked };
		});

	const prizeHint = prizeHonestyHint(tournament.prizeStatus, tournament.prizePool);
	const payoutPreview = buildPayoutPreview({
		tournamentStatus: tournament.status,
		prizeStatus: tournament.prizeStatus,
		prizePool: tournament.prizePool,
		organizerBalance: organizerBalance,
		prizeCurrency: tournament.prizeCurrency,
		allocations: tournament.prizeAllocations.map((row) => ({
			place: row.place,
			amount: row.amount,
			status: row.status,
			teamId: row.teamId
		})),
		finalMatch: pickFinalMatch(tournament.matches),
		teamNames: Object.fromEntries(
			tournament.matches.flatMap((match) =>
				[
					match.teamA ? ([match.teamA.id, match.teamA.name] as const) : null,
					match.teamB ? ([match.teamB.id, match.teamB.name] as const) : null
				].filter((row): row is readonly [string, string] => Boolean(row))
			)
		),
		actorId: user?.id,
		ownerId: tournament.createdById,
		actorRole: user?.role
	});
	const trophy = buildCupTrophy({
		tournamentId: tournament.id,
		title: tournament.title,
		startAt: tournament.startAt,
		prizePool: tournament.prizePool,
		prizeStatus: tournament.prizeStatus,
		prizeCurrency: tournament.prizeCurrency,
		broadcast: 'broadcast' in tournament ? tournament.broadcast : null,
		aegisAward: tournament.aegisAward,
		matches: tournament.matches,
		applications: tournament.applications.map((app) => ({
			teamId: app.teamId,
			rosterSnapshot: app.rosterSnapshot,
			team: {
				id: app.team.id,
				name: app.team.name,
				members: app.team.members.map((member) => ({
					userId: member.userId,
					user: { id: member.user.id, displayName: member.user.displayName, steamId: member.user.steamId }
				}))
			}
		}))
	});

	return (
		<TournamentPullRefresh>
		<main className="mx-auto max-w-shell space-y-5 px-4 py-8 md:px-6 lg:py-10">
			<TournamentLive tournamentId={tournament.id} />
			{staff && (() => {
				const staffNext = nextStaffCupAction({
					tournamentId: tournament.id,
					applications: tournament.applications,
					matches: tournament.matches.map((match) => ({
						id: match.id,
						status: match.status,
						reportDeadlineAt: match.reportDeadlineAt,
						disputes: ('disputes' in match ? match.disputes : []).map((row: { status: string }) => ({ status: row.status }))
					}))
				});
				return (
					<>
						{staffNext.code !== 'none' ? (
							<div className="md:hidden rounded-lg border border-aegis/35 bg-aegis/10 px-3 py-2">
								<p className="text-[10px] uppercase tracking-[0.16em] text-aegisSoft">Очередь кубка</p>
								<p className="mt-0.5 text-sm font-semibold text-cream">{staffNext.label}</p>
								<p className="text-[11px] text-muted">{staffNext.hint}</p>
							</div>
						) : null}
						<StickyActionBar
							actionKey={staffNext.label}
							href={staffNext.href}
							label={staffNext.label}
							hint={staffNext.hint}
							urgent={staffNext.code !== 'none'}
						/>
					</>
				);
			})()}
			<header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div className="min-w-0">
					<Link href="/tournaments" className="text-xs text-aegisSoft">← Все турниры</Link>
					<h1 className="mt-2 font-display text-3xl text-cream md:text-4xl">{tournament.title}</h1>
					<p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{tournament.description || 'Карточка турнира: заявки, кто принят, пары и сетка.'}</p>
				</div>
				<div className="flex flex-wrap items-center gap-2 lg:justify-end">
					<StatusPill tone={tournamentStatusCopy[tournament.status]?.tone ?? 'info'}>{tournamentStatusCopy[tournament.status]?.label ?? tournament.status}</StatusPill>
					{isCupDryRun(tournament.title) && <StatusPill tone="muted">прогон стенда</StatusPill>}
					{isCupShowcase(tournament.title) && <StatusPill tone="aegis">витрина кубка</StatusPill>}
					{landingPrizeKind(tournament.prizeStatus, tournament.prizePool) === 'unconfirmed' && (
						<StatusPill tone="info">фонд не зарезервирован</StatusPill>
					)}
				</div>
			</header>
			<section aria-label="Сводка кубка" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<CupFact
					kicker="Что сейчас"
					title={tournamentStatusCopy[tournament.status]?.label ?? tournament.status}
					hint={tournamentStatusCopy[tournament.status]?.hint ?? ''}
				/>
				<CupFact
					kicker="Формат"
					title={formatCopy[tournament.format] ?? tournament.format}
					hint={`Серия ${tournament.seriesRules} · до ${tournament.maxTeams} команд${tournament.rankCap ? ` · потолок ${tournament.rankCap}` : ''}`}
				/>
				<CupFact
					kicker="Фонд"
					title={formatPrizeAmount(tournament.prizePool, tournament.prizeCurrency)}
					hint={prizeHint || (tournament.status === 'FINISHED' ? 'Места пишутся по финалу, не по готовности накануне.' : 'Выплата капитанам — только после финала.')}
				/>
				<CupFact
					kicker="Старт"
					title={formatMoscowLabel(tournament.startAt)}
					hint={[tournament.region, tournament.status === 'CANCELLED' ? 'Турнир остановлен' : 'В день старта состав отвечает «я готов» или «не смогу».'].filter(Boolean).join(' · ')}
				/>
			</section>

			{trophy && <CupTrophy trophy={{ ...trophy, href: undefined }} />}
			{(tournament.status === 'FINISHED' || tournament.status === 'LIVE') && (
				<div className="grid items-start gap-4 xl:grid-cols-2">
					<PrizeRosterCard preview={payoutPreview} />
				</div>
			)}

			{staff && <BroadcastDesk tournamentId={tournament.id} />}

			{staff && canEditTournamentFields(tournament.status) && (
				<TournamentEditForm
					tournamentId={tournament.id}
					initial={{
						title: tournament.title,
						description: tournament.description,
						rules: tournament.rules,
						prizePool: tournament.prizePool,
						startAt: tournament.startAt,
						checkInOpensAt: tournament.checkInOpensAt,
						checkInClosesAt: tournament.checkInClosesAt,
						region: tournament.region,
						rankCap: tournament.rankCap,
						seriesRules: tournament.seriesRules,
						maxTeams: tournament.maxTeams,
						format: tournament.format,
						inviteOnly: tournament.inviteOnly,
						aegisAward: tournament.aegisAward
					}}
				/>
			)}

			<section className={`grid items-start gap-4 ${staff ? 'xl:grid-cols-2' : ''}`}>
				<RefereeDesk
					tournamentId={tournament.id}
					canManage={canManageStaff}
					staff={staffRows}
					inbox={staff ? staffInbox : []}
					knownReferees={knownRefereeRows.map((row) => ({
						userId: row.id,
						displayName: row.displayName,
						steamId: row.steamId,
						avatarUrl: row.avatarUrl,
						ratingLabel: refereeRatingLabel(row.rating, row.ratingGames),
						cups: row.tournamentStaff.length
					}))}
					nominations={nominationViews}
					leaderId={ballotLeaderId}
					canNominate={canNominateReferee({ tournamentStatus: tournament.status, isCaptain: captainHere })}
					canVote={canVoteReferee({ tournamentStatus: tournament.status, isCaptain: captainHere })}
				/>
				{staff && (
					<div className="space-y-4">
						<EscrowPayoutMobileStrip preview={payoutPreview} />
						<div id="payouts" className="scroll-mt-24">
							<PayoutConfirmPanel
								tournamentId={tournament.id}
								prizePool={tournament.prizePool}
								preview={payoutPreview}
							/>
						</div>
					</div>
				)}
			</section>

			<section className={`grid items-start gap-4 ${swapTargets.length > 0 ? 'xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]' : ''}`}>
			<TournamentActions
				tournamentId={tournament.id}
				status={tournament.status}
				startAt={tournament.startAt.toISOString()}
				checkInClosesLabel={tournament.checkInClosesAt ? formatMoscowLabel(tournament.checkInClosesAt) : null}
				isStaff={staff}
				escrow={{ ...describeEscrowWallet({ prizePool: tournament.prizePool, balance: organizerBalance }), prizeStatus: tournament.prizeStatus }}
				broadcast={(() => {
					const desk = parseBroadcast('broadcast' in tournament ? tournament.broadcast : null);
					return {
						twitchChannel: desk.twitch ?? '',
						twitchSecondary: desk.twitchSecondary ?? '',
						youtubeUrl: desk.youtubeUrl ?? '',
						dotaTv: desk.dotaTv ?? '',
						lobbyName: desk.lobbyName ?? '',
						delaySec: String(desk.delaySec),
						discordWebhook: desk.discordWebhook ?? '',
						telegramChatId: desk.telegramChatId ?? '',
						highlights: desk.highlights.join('\n')
					};
				})()}
				myTeams={myTeams.map((team) => ({
					id: team.id,
					name: team.name,
					confirmedCount: team.members.filter((member) => member.user.steamId).length
				}))}
				applications={tournament.applications.map((app) => ({
					id: app.id,
					teamId: app.teamId,
					status: app.status,
					readyStatus: readReadiness(app.rosterSnapshot).status,
					team: app.team
				}))}
			/>

			{swapTargets.length > 0 && (
				<div className="grid items-start gap-3 sm:grid-cols-2 2xl:grid-cols-3">
					{swapTargets.map((target) => (
						<RosterSwapForm
							key={target.teamId}
							tournamentId={tournament.id}
							teamId={target.teamId}
							teamName={target.teamName}
							canSwap
							locked={target.locked}
							currentRoster={target.current}
							bench={target.bench}
						/>
					))}
				</div>
			)}
			</section>

			<div className="scroll-mt-24">
			<ApplicationPipeline
				startAt={tournament.startAt.toISOString()}
				tournamentStatus={tournament.status}
				tournamentId={tournament.id}
				isStaff={staff}
				applications={(() => {
					const places = pickFinalMatch(tournament.matches);
					const byPlace = places ? placeTeamsFromFinal(places) : {};
					return tournament.applications.map((app) => ({
						id: app.id,
						status: app.status,
						readyStatus: readReadiness(app.rosterSnapshot).status,
						place: byPlace[1] === app.teamId ? 1 : byPlace[2] === app.teamId ? 2 : null,
						team: { name: app.team.name },
						captainId: app.team.createdById,
						memberIds: app.team.members.map((member) => member.userId)
					}));
				})()}
			/>
			</div>

			<div id="matches" className="scroll-mt-24">
			<MatchReadyBoard
				currentUserId={user?.id ?? null}
				isStaff={staff}
				tournamentStatus={tournament.status}
				applicationStatusByTeamId={Object.fromEntries(
					tournament.applications.map((app) => [app.teamId, app.status])
				)}
				matches={tournament.matches.map((match) => {
					const canViewEvidence = Boolean(
						user &&
							(staff ||
								match.teamA?.createdById === user.id ||
								match.teamB?.createdById === user.id)
					);
					const disputes = 'disputes' in match ? match.disputes : [];
					const memberIds = [
						match.teamA?.createdById,
						match.teamB?.createdById,
						...((match.teamA as { members?: Array<{ userId?: string; user?: { id: string } }> } | null)?.members?.map(
							(member) => member.userId ?? member.user?.id
						) ?? []),
						...((match.teamB as { members?: Array<{ userId?: string; user?: { id: string } }> } | null)?.members?.map(
							(member) => member.userId ?? member.user?.id
						) ?? [])
					];
					const canSeeLobbySecrets = Boolean(user && canViewMatchLobby(user.id, memberIds, staff));
					const deputyA = match.teamA ? deputyIdFromMembers(match.teamA.members, match.teamA.createdById) : null;
					const deputyB = match.teamB ? deputyIdFromMembers(match.teamB.members, match.teamB.createdById) : null;
					const canPostLobby = Boolean(
						user &&
							canPostMatchLobby(user.id, match.teamA?.createdById, match.teamB?.createdById, staff, deputyA, deputyB)
					);
					const membersOf = (
						team: {
							members?: Array<{
								isSubstitute?: boolean;
								user?: {
									id: string;
									displayName: string;
									avatarUrl?: string | null;
									openDotaRankTier?: number | null;
									openDotaLeaderboard?: number | null;
									openDotaMmr?: number | null;
									openDotaMmrSource?: string | null;
								};
							}>;
						} | null
					) =>
						(team?.members ?? []).map((member) => {
							const medal = rankMedalFromTier(member.user?.openDotaRankTier, member.user?.openDotaLeaderboard);
							const mmr = storedOpenDotaMmr(member.user?.openDotaMmr, member.user?.openDotaMmrSource);
							const rankLabel = medal ? medalCaption(medal) : mmr ? formatOpenDotaMmrCompact(mmr) : null;
							return {
								userId: member.user?.id,
								displayName: member.user?.displayName ?? '',
								avatarUrl: member.user?.avatarUrl ?? null,
								confirmed: true,
								isSubstitute: Boolean(member.isSubstitute),
								rankLabel,
								medal: medal ?? null
							};
						});
					const playersOf = (
						frozen: unknown,
						team: {
							id: string;
							members?: Array<{
								isSubstitute?: boolean;
								user?: {
									id: string;
									displayName: string;
									avatarUrl?: string | null;
									openDotaRankTier?: number | null;
									openDotaLeaderboard?: number | null;
									openDotaMmr?: number | null;
									openDotaMmrSource?: string | null;
								};
							}>;
						} | null
					) =>
						playersForReadyStrip(
							displayedRoster(frozen, team ? teamBoard[team.id]?.snapshot : null),
							membersOf(team)
						);
					const side = (
						team: { id: string; name: string; createdById: string; members?: Array<{ userId?: string; role?: string; user?: { id: string } }> } | null,
						frozen: unknown
					) => {
						if (!team) return null;
						const rosterMembers: Array<{ userId: string; role?: string }> = [];
						for (const member of team.members ?? []) {
							const userId = member.userId ?? member.user?.id;
							if (userId) rosterMembers.push({ userId, role: member.role });
						}
						const deputyId = deputyIdFromMembers(rosterMembers, team.createdById);
						const people = displayedRoster(frozen, teamBoard[team.id]?.snapshot);
						return {
							id: team.id,
							name: team.name,
							createdById: team.createdById,
							deputyId,
							memberIds: (team.members ?? []).map((member) => member.userId ?? member.user?.id).filter((id): id is string => Boolean(id)),
							readyStatus: teamBoard[team.id]?.readyStatus,
							roster: people.map((player) => player.displayName),
							rosterPeople: people.map((player) => ({
								name: player.displayName,
								badge: player.userId ? rosterBadge(player.userId, team.createdById, deputyId) : null
							})),
							rosterFrozen: rosterFromSnapshot(frozen).length > 0
						};
					};
					return {
						id: match.id,
						round: match.round,
						bracket: match.bracket,
						bestOf: match.bestOf,
						status: match.status,
						scoreA: match.scoreA,
						scoreB: match.scoreB,
						winnerTeamId: match.winnerTeamId,
						nextMatchId: 'nextMatchId' in match ? match.nextMatchId : null,
						nextLoserMatchId: 'nextLoserMatchId' in match ? match.nextLoserMatchId : null,
						reportDeadlineLabel: match.reportDeadlineAt ? formatMoscowLabel(match.reportDeadlineAt) : null,
						lobby: publicMatchLobby(parseMatchLobby('lobby' in match ? match.lobby : null), canSeeLobbySecrets),
						canPostLobby,
						canSeeLobbySecrets,
						reportedTeamIds: reportedTeamIdsOf(match),
						teamA: side(match.teamA, 'rosterA' in match ? match.rosterA : null),
						teamB: side(match.teamB, 'rosterB' in match ? match.rosterB : null),
										readyCheck:
							match.teamA && match.teamB
								? buildReadyCheck({
										teamA: {
											name: match.teamA.name,
											readyStatus: teamBoard[match.teamA.id]?.readyStatus,
											players: playersOf('rosterA' in match ? match.rosterA : null, match.teamA)
										},
										teamB: {
											name: match.teamB.name,
											readyStatus: teamBoard[match.teamB.id]?.readyStatus,
											players: playersOf('rosterB' in match ? match.rosterB : null, match.teamB)
										}
									})
								: null,
						canViewEvidence,
						disputes: disputes.map((row: { id: string; reason: string; details: string | null; status: string; evidenceKind: string | null; evidenceUrl: string | null; evidenceName: string | null; evidenceKey?: string | null }) => ({
							id: row.id,
							reason: row.reason,
							details: row.details,
							status: row.status,
							hasEvidence: Boolean(row.evidenceKey || row.evidenceUrl),
							evidenceKind: canViewEvidence ? row.evidenceKind : null,
							evidenceUrl: canViewEvidence ? row.evidenceUrl : null,
							evidenceName: canViewEvidence ? row.evidenceName : null
						}))
					};
				})}
			/>
			</div>

		</main>
		</TournamentPullRefresh>
	);
}

function CupFact({ kicker, title, hint }: { kicker: string; title: string; hint: string }) {
	return (
		<article className="obsidian-glass rounded-card p-4">
			<p className="text-[10px] uppercase tracking-[0.16em] text-aegisSoft">{kicker}</p>
			<p className="mt-1 font-display text-lg leading-snug text-cream">{title}</p>
			<p className="mt-1 text-xs leading-5 text-muted">{hint}</p>
		</article>
	);
}
