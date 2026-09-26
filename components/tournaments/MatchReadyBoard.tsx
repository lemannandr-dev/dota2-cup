'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { matchHandshake } from '@/lib/match-handshake';
import { DisputeEvidencePanel, type DisputeRow } from '@/components/tournaments/DisputeEvidencePanel';
import { MatchScoreForm } from '@/components/tournaments/MatchScoreForm';
import { MatchLobbyCard } from '@/components/tournaments/MatchLobbyCard';
import { ReadyCheckStrip } from '@/components/tournaments/ReadyCheckStrip';
import type { MatchLobby } from '@/lib/match-lobby';
import type { ReadyCheckBoard } from '@/lib/ready-check';
import { buildMatchRecap } from '@/lib/match-recap';
import { MatchRecapCard } from '@/components/tournaments/MatchRecapCard';
import { StatusPill } from '@/components/dota/StatusPill';
import { bracketCopy } from '@/lib/tournament-copy';
import { MatchDayNextStep } from '@/components/match-day/MatchDayNextStep';
import { buildMatchDayChecklist, nextMatchDayAction } from '@/lib/match-day';
import { RoleBadge } from '@/components/dota/RoleBadge';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { StickyActionBar } from '@/components/ui/StickyActionBar';
import { useToast } from '@/components/ui/ToastProvider';
import { groupMatchRounds, matchRoundKey, winsToTakeSeries } from '@/lib/match-rounds';

type Team = {
	id: string;
	name: string;
	createdById?: string;
	deputyId?: string | null;
	memberIds?: string[];
	readyStatus?: string;
	roster?: string[];
	rosterPeople?: Array<{ name: string; badge?: 'captain' | 'deputy' | null }>;
	rosterFrozen?: boolean;
} | null;

export type BoardMatch = {
	id: string;
	round: number;
	bracket: string;
	bestOf: number;
	status: string;
	scoreA: number;
	scoreB: number;
	winnerTeamId: string | null;
	teamA: Team;
	teamB: Team;
	reportedTeamIds: string[];
	disputes?: DisputeRow[];
	canViewEvidence?: boolean;
	reportDeadlineLabel?: string | null;
	lobby?: MatchLobby | null;
	canPostLobby?: boolean;
	canSeeLobbySecrets?: boolean;
	readyCheck?: ReadyCheckBoard | null;
	nextMatchId?: string | null;
	nextLoserMatchId?: string | null;
};

type Props = {
	matches: BoardMatch[];
	currentUserId: string | null;
	isStaff: boolean;
	tournamentStatus?: string;
	applicationStatusByTeamId?: Record<string, string>;
};

function toneFor(state: string): 'radiant' | 'info' | 'aegis' | 'muted' | 'dire' {
	if (state === 'confirmed' || state === 'done') return 'radiant';
	if (state === 'waiting_rival') return 'info';
	if (state === 'disputed') return 'dire';
	if (state === 'ready') return 'aegis';
	return 'muted';
}

type MatchDayInput = Parameters<typeof nextMatchDayAction>[0];

function viewerTeamFor(match: BoardMatch, currentUserId: string | null): NonNullable<Team> | null {
	if (!currentUserId) return null;
	const isOnTeam = (team: Team) => Boolean(
		team &&
			(team.createdById === currentUserId || team.deputyId === currentUserId || team.memberIds?.includes(currentUserId))
	);
	if (isOnTeam(match.teamA)) return match.teamA;
	if (isOnTeam(match.teamB)) return match.teamB;
	return null;
}

function matchDayInputFor(
	match: BoardMatch,
	viewerTeam: NonNullable<Team>,
	currentUserId: string,
	tournamentStatus: string,
	applicationStatus: string
): MatchDayInput {
	const pairClosed = ['COMPLETED', 'TECHNICAL'].includes(match.status);
	return {
		tournamentStatus,
		applicationStatus,
		readyStatus: viewerTeam.readyStatus,
		openMatch: !pairClosed
			? {
					status: match.status,
					youReported: match.reportedTeamIds.includes(viewerTeam.id),
					lobbyPosted: Boolean(match.lobby?.name),
					isCaptain: viewerTeam.createdById === currentUserId || viewerTeam.deputyId === currentUserId,
					reportDeadlineLabel: match.reportDeadlineLabel
				}
			: null,
		lastClosed: pairClosed ? { won: match.winnerTeamId === viewerTeam.id } : null
	};
}

export function MatchReadyBoard({
	matches,
	currentUserId,
	isStaff,
	tournamentStatus = 'LIVE',
	applicationStatusByTeamId = {}
}: Props) {
	const waiting = matches.filter((match) => {
		const hand = matchHandshake({
			status: match.status,
			teamAId: match.teamA?.id,
			teamBId: match.teamB?.id,
			reportedTeamIds: match.reportedTeamIds,
			winnerTeamId: match.winnerTeamId
		});
		return hand.state === 'waiting_opponent' || hand.state === 'waiting_rival' || hand.state === 'ready';
	});
	const accepted = matches.filter((match) => {
		const hand = matchHandshake({
			status: match.status,
			teamAId: match.teamA?.id,
			teamBId: match.teamB?.id,
			reportedTeamIds: match.reportedTeamIds,
			winnerTeamId: match.winnerTeamId
		});
		return hand.state === 'confirmed' || hand.state === 'done';
	});
	const disputed = matches.filter((match) => match.status === 'NEEDS_REVIEW');
	let stickyAction: { matchId: string; label: string; hint: string } | null = null;
	const actionableCodes = new Set(['check_in', 'ready', 'wait_review', 'post_lobby', 'join_lobby', 'report', 'dispute']);
	if (currentUserId) {
		for (const match of matches) {
			const viewerTeam = viewerTeamFor(match, currentUserId);
			if (!viewerTeam) continue;
			const appStatus = applicationStatusByTeamId[viewerTeam.id] ?? 'IN_BRACKET';
			const action = nextMatchDayAction(matchDayInputFor(match, viewerTeam, currentUserId, tournamentStatus, appStatus));
			if (actionableCodes.has(action.code)) {
				stickyAction = { matchId: match.id, label: action.label, hint: `${viewerTeam.name} · ${action.hint}` };
				break;
			}
		}
	}
	const roundGroups = groupMatchRounds(matches);
	const preferredRound =
		roundGroups.find((group) => group.matches.some((match) => match.id === stickyAction?.matchId))?.key ??
		roundGroups.find((group) => group.matches.some((match) => !['COMPLETED', 'TECHNICAL'].includes(match.status)))?.key ??
		roundGroups[0]?.key ??
		'';
	const [mobileRound, setMobileRound] = useState(preferredRound);

	useEffect(() => {
		if (!roundGroups.some((group) => group.key === mobileRound)) setMobileRound(preferredRound);
	}, [mobileRound, preferredRound, roundGroups]);

	if (matches.length === 0) {
		return (
			<section className="obsidian-glass rounded-card p-4 text-sm leading-6 text-muted md:p-5">
				Пары команд появятся после check-in и кнопки «Собрать сетку». До этого команды не играют друг против друга — они только в списке заявок.
			</section>
		);
	}

	return (
		<section id="bracket" className={stickyAction ? 'scroll-mt-24 space-y-4 pb-20 md:pb-0' : 'scroll-mt-24 space-y-4'}>
			<div>
				<h2 className="font-display text-lg text-cream md:text-xl">Сетка и матчи</h2>
				<p className="mt-1 text-xs leading-5 text-muted md:hidden">Выберите раунд и откройте нужную пару.</p>
				<p className="mt-1 hidden text-sm text-muted md:block">
					Капитан сдаёт счёт. Соперник должен принять тот же счёт. Пока второй не подтвердил — пара в ожидании. Если счета разные — спор.
				</p>
				{!currentUserId && (
					<p className="mt-2 hidden text-xs text-muted md:block">
						Вы смотрите как гость: чеклист «как зайти» и пароль лобби закрыты. Эфир находится на карточке турнира.
					</p>
				)}
				{isStaff && (
					<p className="mt-2 text-sm text-aegisSoft">
						Карточка судьи: состав пятёрки, готовность, решение спора и техпоражение за неявку.
					</p>
				)}
			</div>
			<dl className="grid grid-cols-3 divide-x divide-line/70 rounded-lg border border-line/70 bg-panel/30 text-sm">
				<div className="px-3 py-2.5">
					<dt className="text-xs text-muted md:text-sm">Ожидают</dt>
					<dd className="mt-0.5 font-mono text-xl text-cream md:font-display md:text-2xl">{waiting.length}</dd>
				</div>
				<div className="px-3 py-2.5">
					<dt className="text-xs text-muted md:text-sm"><span className="md:hidden">Приняты</span><span className="hidden md:inline">Приняли между собой</span></dt>
					<dd className="mt-0.5 font-mono text-xl text-aegisSoft md:font-display md:text-2xl">{accepted.length}</dd>
				</div>
				<div className="px-3 py-2.5">
					<dt className="text-xs text-muted md:text-sm">Споры</dt>
					<dd className="mt-0.5 font-mono text-xl text-cream md:font-display md:text-2xl">{disputed.length}</dd>
				</div>
			</dl>
			<div className="md:hidden">
				<p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-muted">Этап сетки</p>
				<div className="mobile-scroll-row flex snap-x gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Раунд сетки">
					{roundGroups.map((group) => (
						<button
							key={group.key}
							type="button"
							role="tab"
							aria-selected={mobileRound === group.key}
							onClick={() => setMobileRound(group.key)}
							className={`min-h-12 min-w-[124px] snap-start rounded-lg border px-3 text-left transition active:scale-[0.97] ${
								mobileRound === group.key ? 'border-info bg-info/15 text-cream shadow-[inset_0_-2px_0_#72A7FF]' : 'border-line bg-panel/50 text-muted'
							}`}
						>
							<span className="block truncate text-xs font-semibold">{bracketCopy[group.bracket] ?? 'Сетка'}</span>
							<span className="mt-0.5 block text-[10px] opacity-75">Раунд {group.round} · {group.matches.length} матч.</span>
						</button>
					))}
				</div>
			</div>
			<div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
				{matches.map((match) => {
					const hand = matchHandshake({
						status: match.status,
						teamAId: match.teamA?.id,
						teamBId: match.teamB?.id,
						reportedTeamIds: match.reportedTeamIds,
						winnerTeamId: match.winnerTeamId
					});
					const canReport = Boolean(
						currentUserId &&
							(match.teamA?.createdById === currentUserId ||
								match.teamA?.deputyId === currentUserId ||
								match.teamB?.createdById === currentUserId ||
								match.teamB?.deputyId === currentUserId) &&
							!['COMPLETED', 'TECHNICAL'].includes(match.status)
					);
					const aDone = match.teamA ? match.reportedTeamIds.includes(match.teamA.id) : false;
					const bDone = match.teamB ? match.reportedTeamIds.includes(match.teamB.id) : false;
					const viewerTeam = viewerTeamFor(match, currentUserId);
					const appStatus = viewerTeam ? applicationStatusByTeamId[viewerTeam.id] ?? 'IN_BRACKET' : 'IN_BRACKET';
					const pairInput =
						viewerTeam && currentUserId
							? matchDayInputFor(match, viewerTeam, currentUserId, tournamentStatus, appStatus)
							: null;
					const pairAction = pairInput ? nextMatchDayAction(pairInput) : null;
					return (
						<div
							id={`match-${match.id}`}
							key={match.id}
							className={`obsidian-glass min-w-0 rounded-card space-y-3 p-4 ${matchRoundKey(match) === mobileRound ? 'block' : 'hidden md:block'}`}
						>
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div className="text-sm text-cream">
									{bracketCopy[match.bracket] ?? 'Сетка'} · раунд {match.round} · BO{match.bestOf} · до {winsToTakeSeries(match.bestOf)} побед
								</div>
								<StatusPill tone={toneFor(hand.state)}>{hand.label}</StatusPill>
							</div>
							{pairAction && (
								<MatchDayNextStep
									action={pairAction}
									href={`#match-${match.id}`}
									steps={pairInput ? buildMatchDayChecklist(pairInput) : undefined}
								/>
							)}
							{!viewerTeam && currentUserId && !isStaff && (
								<p className="text-xs text-muted">Чеклист «как зайти» закрыт: вы не в составе этой пары. Эфир — стол Watch.</p>
							)}
							{match.reportDeadlineLabel && !['COMPLETED', 'TECHNICAL'].includes(match.status) && (
								<p className="text-xs text-muted">
									Сдать счёт до {match.reportDeadlineLabel} (МСК). Если один капитан сдал, а второй молчит — техпоражение без судьи.
								</p>
							)}
							<div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_1fr] md:items-center">
								<div className={`rounded-lg border px-3 py-2 ${aDone ? 'border-aegis/50 bg-aegis/10' : 'border-line'}`}>
									<div className="flex flex-wrap items-center gap-2 text-cream">
										{match.teamA?.name ?? 'Ожидаем команду'}
										{currentUserId && match.teamA?.createdById === currentUserId && <RoleBadge kind="captain" />}
										{currentUserId && match.teamA?.deputyId === currentUserId && <RoleBadge kind="deputy" />}
									</div>
									<div className="text-xs text-muted">
										{match.teamA?.readyStatus === 'READY' ? 'Готовы · ' : match.teamA?.readyStatus === 'DECLINED' ? 'Не сыграют · ' : ''}
										{aDone ? 'капитан сдал счёт' : 'счёт ещё не сдан'}
									</div>
									{(match.teamA?.rosterPeople?.length || match.teamA?.roster?.length) ? (
										<div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted">
											{match.teamA.rosterFrozen ? 'Состав этой пары: ' : 'Состав: '}
											{(match.teamA.rosterPeople ?? match.teamA.roster?.map((name) => ({ name, badge: null })) ?? []).map((player) => (
												<span key={player.name} className="inline-flex max-w-full items-center gap-1 whitespace-nowrap">
													{player.name}
													<RoleBadge kind={player.badge} />
												</span>
											))}
										</div>
									) : null}
								</div>
								<div className="text-center font-mono text-aegisSoft">{match.scoreA}:{match.scoreB}</div>
								<div className={`rounded-lg border px-3 py-2 ${bDone ? 'border-aegis/50 bg-aegis/10' : 'border-line'}`}>
									<div className="flex flex-wrap items-center gap-2 text-cream">
										{match.teamB?.name ?? 'Ожидаем команду'}
										{currentUserId && match.teamB?.createdById === currentUserId && <RoleBadge kind="captain" />}
										{currentUserId && match.teamB?.deputyId === currentUserId && <RoleBadge kind="deputy" />}
									</div>
									<div className="text-xs text-muted">
										{match.teamB?.readyStatus === 'READY' ? 'Готовы · ' : match.teamB?.readyStatus === 'DECLINED' ? 'Не сыграют · ' : ''}
										{bDone ? 'капитан сдал счёт' : 'счёт ещё не сдан'}
									</div>
									{(match.teamB?.rosterPeople?.length || match.teamB?.roster?.length) ? (
										<div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted">
											{match.teamB.rosterFrozen ? 'Состав этой пары: ' : 'Состав: '}
											{(match.teamB.rosterPeople ?? match.teamB.roster?.map((name) => ({ name, badge: null })) ?? []).map((player) => (
												<span key={player.name} className="inline-flex max-w-full items-center gap-1 whitespace-nowrap">
													{player.name}
													<RoleBadge kind={player.badge} />
												</span>
											))}
										</div>
									) : null}
								</div>
							</div>
							{['COMPLETED', 'TECHNICAL'].includes(match.status) && match.winnerTeamId && (
								<ClosedPairRecap match={match} currentUserId={currentUserId} />
							)}
							{match.readyCheck && !['COMPLETED', 'TECHNICAL'].includes(match.status) && (
								<ReadyCheckStrip board={match.readyCheck} />
							)}
							{!['COMPLETED', 'TECHNICAL'].includes(match.status) && match.teamA && match.teamB && (
								<MatchLobbyCard
									matchId={match.id}
									lobby={match.lobby ?? null}
									canPost={Boolean(match.canPostLobby)}
									canSeeSecrets={Boolean(match.canSeeLobbySecrets)}
								/>
							)}
							<MatchScoreForm
								matchId={match.id}
								canReport={canReport}
								canForce={isStaff && match.status !== 'COMPLETED' && match.status !== 'TECHNICAL'}
								waiting={hand.state === 'waiting_rival'}
								teamAName={match.teamA?.name}
								teamBName={match.teamB?.name}
							/>
							<OpenDisputeButton
								matchId={match.id}
								enabled={canReport && !['COMPLETED', 'TECHNICAL', 'NEEDS_REVIEW'].includes(match.status)}
							/>
							{(match.status === 'NEEDS_REVIEW' || (match.disputes?.length ?? 0) > 0) && (
								<DisputeEvidencePanel
									matchId={match.id}
									disputes={match.disputes ?? []}
									canUpload={canReport || isStaff}
									canView={Boolean(match.canViewEvidence)}
									canResolve={isStaff}
								/>
							)}
						</div>
					);
				})}
			</div>
			{stickyAction && !isStaff ? (
				<StickyActionBar
					actionKey={stickyAction.label}
					href={`#match-${stickyAction.matchId}`}
					label={stickyAction.label}
					hint={stickyAction.hint}
					urgent
				/>
			) : null}
		</section>
	);
}

function ClosedPairRecap({ match, currentUserId }: { match: BoardMatch; currentUserId: string | null }) {
	const onSide = (team: NonNullable<Team> | null | undefined) =>
		Boolean(
			currentUserId &&
				team &&
				(team.createdById === currentUserId || team.memberIds?.includes(currentUserId))
		);
	const viewerTeam = onSide(match.teamA) ? match.teamA : onSide(match.teamB) ? match.teamB : null;
	const sides = viewerTeam
		? [viewerTeam]
		: [match.teamA, match.teamB].filter((team): team is NonNullable<Team> => Boolean(team));
	return (
		<>
			{sides.map((team) => {
				const opponent = team.id === match.teamA?.id ? match.teamB : match.teamA;
				const recap = buildMatchRecap({
					matchId: match.id,
					status: match.status,
					scoreA: match.scoreA,
					scoreB: match.scoreB,
					winnerTeamId: match.winnerTeamId,
					teamId: team.id,
					teamName: team.name,
					opponentName: opponent?.name ?? null,
					nextMatchId: match.nextMatchId,
					nextLoserMatchId: match.nextLoserMatchId
				});
				return recap ? <MatchRecapCard key={`${match.id}-${team.id}`} recap={recap} /> : null;
			})}
		</>
	);
}

function OpenDisputeButton({ matchId, enabled }: { matchId: string; enabled: boolean }) {
	const router = useRouter();
	const { showToast } = useToast();
	const [open, setOpen] = useState(false);
	const [details, setDetails] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!enabled) return null;

	async function send() {
		setBusy(true);
		setError(null);
		const idem =
			typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
				? crypto.randomUUID()
				: `dispute-${Date.now()}`;
		const { fetchWithOfflineQueue } = await import('@/lib/offline-queue');
		const { haptic } = await import('@/lib/haptics');
		const result = await fetchWithOfflineQueue({
			url: `/api/matches/${matchId}/disputes`,
			method: 'POST',
			idempotencyKey: idem,
			label: 'Открыть спор',
			body: { reason: 'WRONG_RESULT', details: details.trim() || undefined }
		});
		if (result.offline) {
			showToast('Отправим, когда сеть вернётся', 'info');
			setOpen(false);
			setBusy(false);
			return;
		}
		const data = result.json as { error?: string } | null;
		if (!result.ok) {
			setError(data?.error || 'Не удалось открыть спор');
			setBusy(false);
			return;
		}
		setOpen(false);
		setDetails('');
		haptic('warn');
		showToast('Спор передан судье', 'info');
		router.refresh();
		setBusy(false);
	}

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="inline-flex min-h-11 items-center justify-center rounded-lg border border-red-400/40 px-4 text-sm font-semibold text-red-200 transition-colors hover:bg-red-950/30"
			>
				Открыть спор
			</button>
			<BottomSheet
				open={open}
				onClose={() => {
					if (!busy) setOpen(false);
				}}
				title="Открыть спор"
				description="Судья увидит причину, материалы и историю пары. Используйте спор только при неверном счёте или проблеме с явкой."
				footer={
					<div className="grid grid-cols-2 gap-2">
						<button type="button" disabled={busy} onClick={() => setOpen(false)} className="min-h-12 rounded-lg border border-line px-3 text-sm text-muted disabled:opacity-50">
							Отмена
						</button>
						<button type="button" disabled={busy} onClick={() => void send()} className="min-h-12 rounded-lg bg-red-200 px-3 text-sm font-semibold text-ink disabled:opacity-50">
							{busy ? 'Отправляю…' : 'Передать судье'}
						</button>
					</div>
				}
			>
				<label className="block text-sm font-medium text-cream" htmlFor={`dispute-details-${matchId}`}>Что произошло</label>
				<textarea
					id={`dispute-details-${matchId}`}
					value={details}
					onChange={(event) => setDetails(event.target.value)}
					placeholder="Опишите расхождение счёта или проблему с явкой"
					className="mt-2 min-h-28 w-full rounded-lg border border-line bg-ink px-3 py-3 text-base text-cream outline-none transition-colors focus:border-aegis"
					rows={4}
				/>
				{error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
			</BottomSheet>
		</>
	);
}
