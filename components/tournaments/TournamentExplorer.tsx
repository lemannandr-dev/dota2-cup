'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { StatusPill } from '@/components/dota/StatusPill';
import { TeamLogo } from '@/components/teams/TeamLogo';
import { BracketMatchupPreview, useBracketMatchupPreview } from '@/components/tournaments/BracketMatchupPreview';
import type { MatchupPlayer, MatchupTeam } from '@/lib/bracket-matchup';
import { publicPrizeCaption } from '@/lib/landing-live';

type Tone = 'radiant' | 'info' | 'aegis' | 'muted' | 'dire';

type TeamLite = {
	id: string;
	name: string;
	tag: string | null;
	logo: string | null;
	region: string | null;
	membersCount: number;
	members: Array<{
		id: string;
		displayName: string;
		avatarUrl: string | null;
		steamId: string | null;
		role: string;
		confirmed: boolean;
		rankTier?: number | null;
		leaderboard?: number | null;
		openDotaMmr?: number | null;
		openDotaMmrSource?: string | null;
		arenaRating?: number | null;
		heroes?: Array<{ heroId: number; level: number; name?: string | null; image?: string | null }>;
	}>;
	topPlayers: Array<{
		id: string;
		displayName: string;
		avatarUrl: string | null;
		steamId: string | null;
		score: number;
		kda: number | null;
		winRate: number | null;
		heroName: string | null;
		heroImage: string | null;
	}>;
};

type ApplicationLite = {
	id: string;
	status: string;
	seed: number | null;
	checkedInAt: string | null;
	team: TeamLite;
};

type MatchLite = {
	id: string;
	round: number;
	position: number;
	bracket: string;
	bestOf: number;
	status: string;
	scoreA: number;
	scoreB: number;
	winnerTeamId: string | null;
	startedAt: string | null;
	finishedAt: string | null;
	teamA: TeamLite | null;
	teamB: TeamLite | null;
};

export type TournamentRow = {
	id: string;
	title: string;
	description: string | null;
	format: string;
	status: string;
	maxTeams: number;
	seriesRules: string;
	region: string | null;
	rankCap: string | null;
	prizePool: number;
	prizeCurrency: string;
	prizeStatus: string;
	startAt: string;
	checkInOpensAt: string | null;
	checkInClosesAt: string | null;
	rules: string | null;
	applications: ApplicationLite[];
	matches: MatchLite[];
};

type Props = { tournaments: TournamentRow[] };

const statusLabels: Record<string, { label: string; tone: Tone }> = {
	DRAFT: { label: 'Черновик', tone: 'muted' },
	REGISTRATION: { label: 'Регистрация', tone: 'radiant' },
	CHECK_IN: { label: 'Check-in', tone: 'info' },
	LIVE: { label: 'Идёт', tone: 'aegis' },
	FINISHED: { label: 'Завершён', tone: 'muted' },
	CANCELLED: { label: 'Отменён', tone: 'dire' }
};

const appStatusLabels: Record<string, string> = {
	DRAFT: 'Черновик',
	SUBMITTED: 'Заявка',
	NEEDS_ACTION: 'Нужно действие',
	APPROVED: 'Одобрена',
	CHECKED_IN: 'Check-in',
	IN_BRACKET: 'В сетке',
	REJECTED: 'Отклонена',
	WITHDRAWN: 'Снята',
	NO_CHECK_IN: 'Нет check-in',
	DISQUALIFIED: 'DQ'
};

const matchStatusLabels: Record<string, string> = {
	PENDING: 'Ожидает',
	SCHEDULED: 'Запланирован',
	LIVE: 'Live',
	NEEDS_REVIEW: 'Ревью',
	COMPLETED: 'Завершён',
	TECHNICAL: 'Тех. результат'
};

function prizeCaption(tournament: Pick<TournamentRow, 'prizePool' | 'prizeCurrency' | 'prizeStatus'>) {
	return publicPrizeCaption(tournament.prizeStatus, tournament.prizePool, tournament.prizeCurrency).label;
}

function formatDate(value: string | null) {
	if (!value) return 'Не задано';
	const date = new Date(value);
	const day = String(date.getUTCDate()).padStart(2, '0');
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const hours = String(date.getUTCHours()).padStart(2, '0');
	const minutes = String(date.getUTCMinutes()).padStart(2, '0');
	return `${day}.${month}, ${hours}:${minutes}`;
}

function teamMark(team: TeamLite | null) {
	if (!team) return 'TBD';
	return team.tag || team.name.slice(0, 2).toUpperCase();
}

function buildPreviewMatches(applications: ApplicationLite[]): MatchLite[] {
	const approved = [...applications]
		.filter((app) => !['REJECTED', 'WITHDRAWN', 'DISQUALIFIED'].includes(app.status))
		.sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));

	const matches: MatchLite[] = [];
	for (let index = 0; index < approved.length; index += 2) {
		matches.push({
			id: `preview-${approved[index]?.id ?? index}`,
			round: 1,
			position: Math.floor(index / 2),
			bracket: 'preview',
			bestOf: 1,
			status: 'PENDING',
			scoreA: 0,
			scoreB: 0,
			winnerTeamId: null,
			startedAt: null,
			finishedAt: null,
			teamA: approved[index]?.team ?? null,
			teamB: approved[index + 1]?.team ?? null
		});
	}
	return matches;
}

export function TournamentExplorer({ tournaments }: Props) {
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [query, setQuery] = useState('');
	const [status, setStatus] = useState('ALL');

	const filtered = useMemo(() => {
		const value = query.trim().toLowerCase();
		return tournaments.filter((tournament) => {
			const matchesStatus = status === 'ALL' || tournament.status === status;
			const matchesQuery = !value || [tournament.title, tournament.region, tournament.seriesRules].filter(Boolean).some((field) => field!.toLowerCase().includes(value));
			return matchesStatus && matchesQuery;
		});
	}, [query, status, tournaments]);

	return (
		<div className="space-y-6">
			<div className="obsidian-glass rounded-card overflow-hidden">
				<div className="border-b border-line/70 bg-gradient-to-br from-panel2 via-ink to-panel p-5">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
						<div>
							<div className="text-xs uppercase tracking-[0.22em] text-aegisSoft">Tournament Control</div>
							<h2 className="mt-1 font-display text-2xl text-cream">Турнирная сетка и матчи</h2>
						</div>
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-[220px_180px]">
							<input
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								aria-label="Поиск турнира"
								className="min-h-12 rounded-lg border border-line bg-ink/80 px-3 py-2 text-base text-cream outline-none focus:border-aegis"
								placeholder="Поиск турнира"
							/>
							<select
								value={status}
								onChange={(event) => setStatus(event.target.value)}
								aria-label="Фильтр по статусу турнира"
								className="rounded-lg border border-line bg-ink/80 px-3 py-2 text-sm text-cream outline-none focus:border-aegis"
							>
								<option value="ALL">Все статусы</option>
								{Object.entries(statusLabels).map(([key, meta]) => (
									<option key={key} value={key}>
										{meta.label}
									</option>
								))}
							</select>
						</div>
					</div>
				</div>

				{/* Mobile: one action card per cup — no wide desktop table */}
				<div className="space-y-3 p-4 md:hidden">
					{filtered.map((tournament) => {
						const statusMeta = statusLabels[tournament.status] ?? statusLabels.DRAFT;
						const isExpanded = expandedId === tournament.id;
						return (
							<article key={tournament.id} className={`rounded-xl border border-line bg-panel/40 p-4 ${isExpanded ? 'border-aegis/50' : ''}`}>
								<div className="flex items-start justify-between gap-3">
									<button type="button" onClick={() => setExpandedId(isExpanded ? null : tournament.id)} className="min-w-0 flex-1 text-left">
										<div className="font-display text-lg text-cream">{tournament.title}</div>
										<div className="mt-1 text-xs text-muted">
											{tournament.format === 'DOUBLE_ELIMINATION' ? 'Double Elimination' : 'Single Elimination'} · {tournament.seriesRules}
										</div>
									</button>
									<StatusPill tone={statusMeta.tone}>{statusMeta.label}</StatusPill>
								</div>
								<div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
									<div className="rounded-lg border border-line/60 bg-ink/40 px-2 py-2">
										<div className="text-muted">Команды</div>
										<div className="mt-1 font-mono text-cream">{tournament.applications.length}/{tournament.maxTeams}</div>
									</div>
									<div className="rounded-lg border border-line/60 bg-ink/40 px-2 py-2">
										<div className="text-muted">Матчи</div>
										<div className="mt-1 font-mono text-cream">{tournament.matches.length || buildPreviewMatches(tournament.applications).length}</div>
									</div>
									<div className="rounded-lg border border-line/60 bg-ink/40 px-2 py-2">
										<div className="text-muted">Фонд</div>
										<div className="mt-1 font-mono text-aegisSoft">{prizeCaption(tournament)}</div>
									</div>
								</div>
								<p className="mt-2 text-xs text-muted">Старт {formatDate(tournament.startAt)}</p>
								<div className="mt-3 flex flex-wrap gap-2">
									<a
										href={`/tournaments/${tournament.id}`}
										className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-line px-3 text-sm font-semibold text-cream"
									>
										Карточка
									</a>
									<button
										type="button"
										onClick={() => setExpandedId(isExpanded ? null : tournament.id)}
										className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-aegis/50 bg-aegis/10 px-3 text-sm font-semibold text-aegisSoft"
									>
										{isExpanded ? 'Свернуть' : 'Раскрыть'}
									</button>
								</div>
							</article>
						);
					})}
					{filtered.length === 0 && (
						<div className="rounded-xl border border-line bg-panel/40 p-6 text-center text-muted">Турниров по фильтру нет.</div>
					)}
				</div>

				<div className="hidden overflow-x-auto md:block">
					<table className="w-full border-collapse text-left text-sm">
						<thead className="bg-panel2 text-xs uppercase tracking-wide text-muted">
							<tr>
								<th className="px-4 py-3">Турнир</th>
								<th className="px-4 py-3">Статус</th>
								<th className="px-4 py-3">Команды</th>
								<th className="px-4 py-3">Матчи</th>
								<th className="px-4 py-3">Фонд</th>
								<th className="px-4 py-3">Старт</th>
								<th className="px-4 py-3 text-right">Открыть</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-line/70">
							{filtered.map((tournament, index) => {
								const statusMeta = statusLabels[tournament.status] ?? statusLabels.DRAFT;
								const isExpanded = expandedId === tournament.id;
								return (
									<tr key={tournament.id} className={`align-top transition-colors hover:bg-panel/70 ${isExpanded ? 'bg-aegis/5' : ''}`} style={{ animationDelay: `${index * 50}ms` }}>
										<td className="px-4 py-4">
											<button type="button" onClick={() => setExpandedId(isExpanded ? null : tournament.id)} className="text-left">
												<div className="font-display text-base text-cream">{tournament.title}</div>
												<div className="mt-1 text-xs text-muted">{tournament.format === 'DOUBLE_ELIMINATION' ? 'Double Elimination' : 'Single Elimination'} · {tournament.seriesRules}</div>
											</button>
										</td>
										<td className="px-4 py-4"><StatusPill tone={statusMeta.tone}>{statusMeta.label}</StatusPill></td>
										<td className="px-4 py-4 font-mono text-cream">{tournament.applications.length}/{tournament.maxTeams}</td>
										<td className="px-4 py-4 font-mono text-cream">{tournament.matches.length || buildPreviewMatches(tournament.applications).length}</td>
										<td className="px-4 py-4 font-mono text-aegisSoft">{prizeCaption(tournament)}</td>
										<td className="px-4 py-4 text-muted">{formatDate(tournament.startAt)}</td>
										<td className="px-4 py-4 text-right">
											<div className="flex flex-wrap items-center justify-end gap-2">
												<a
													href={`/tournaments/${tournament.id}`}
													className="rounded-full border border-line px-3 py-2 text-xs font-semibold text-cream transition hover:border-aegis hover:text-aegis"
												>
													Карточка
												</a>
												<button type="button" onClick={() => setExpandedId(isExpanded ? null : tournament.id)} className="rounded-full border border-aegis/50 bg-aegis/10 px-3 py-2 text-xs font-semibold text-aegisSoft transition hover:border-aegis">
													{isExpanded ? 'Свернуть' : 'Раскрыть'}
												</button>
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>

			{filtered.map((tournament) => expandedId === tournament.id ? <TournamentDetails key={tournament.id} tournament={tournament} /> : null)}
		</div>
	);
}

function TournamentDetails({ tournament }: { tournament: TournamentRow }) {
	const [selectedTeam, setSelectedTeam] = useState<TeamLite | null>(null);
	const preview = useBracketMatchupPreview();
	const matchRows = tournament.matches.length ? tournament.matches : buildPreviewMatches(tournament.applications);
	const rounds = new Map<number, MatchLite[]>();
	for (const match of matchRows) {
		const list = rounds.get(match.round) ?? [];
		list.push(match);
		rounds.set(match.round, list);
	}
	const bracketColumns = Array.from(rounds.entries()).sort((a, b) => a[0] - b[0]);
	const finalist = matchRows.find((match) => match.winnerTeamId);
	const winner = finalist ? [finalist.teamA, finalist.teamB].find((team) => team?.id === finalist.winnerTeamId) : null;

	function toMatchupTeam(team: TeamLite | null): MatchupTeam | null {
		if (!team) return null;
		return {
			id: team.id,
			name: team.name,
			tag: team.tag,
			logo: team.logo,
			members: team.members.map(
				(member): MatchupPlayer => ({
					id: member.id,
					displayName: member.displayName,
					avatarUrl: member.avatarUrl,
					role: member.role,
					confirmed: member.confirmed,
					rankTier: member.rankTier,
					leaderboard: member.leaderboard,
					openDotaMmr: member.openDotaMmr,
					openDotaMmrSource: member.openDotaMmrSource,
					arenaRating: member.arenaRating,
					heroes: member.heroes
				})
			)
		};
	}

	function openMatchup(match: MatchLite, focusTeamId: string, el: HTMLElement) {
		preview.openPreview({
			teamA: toMatchupTeam(match.teamA),
			teamB: toMatchupTeam(match.teamB),
			focusTeamId,
			anchor: el.getBoundingClientRect()
		});
	}

	return (
		<section className="obsidian-glass rounded-card overflow-hidden fade-up">
			<div className="border-b border-line/70 bg-panel/50 p-6">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div>
						<div className="text-xs uppercase tracking-[0.22em] text-aegisSoft">Полный турнир</div>
						<h2 className="mt-1 font-display text-3xl text-cream">{tournament.title}</h2>
						{tournament.description && <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">{tournament.description}</p>}
						<a
							href={`/tournaments/${tournament.id}`}
							className="mt-4 inline-flex min-h-11 items-center rounded-full border border-aegis/50 bg-aegis/10 px-4 text-sm font-semibold text-aegisSoft transition hover:border-aegis hover:text-aegis"
						>
							Карточка турнира · сетка и день матча
						</a>
					</div>
					<div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
						<div className="rounded-lg border border-line bg-panel/70 p-3"><div className="text-xs text-muted">Регион</div><div className="font-mono text-cream">{tournament.region ?? 'Global'}</div></div>
						<div className="rounded-lg border border-line bg-panel/70 p-3"><div className="text-xs text-muted">Rank cap</div><div className="font-mono text-cream">{tournament.rankCap ?? 'нет'}</div></div>
						<div className="rounded-lg border border-line bg-panel/70 p-3"><div className="text-xs text-muted">Check-in</div><div className="font-mono text-cream">{formatDate(tournament.checkInOpensAt)}</div></div>
						<div className="rounded-lg border border-line bg-panel/70 p-3"><div className="text-xs text-muted">Приз</div><div className="font-mono text-aegisSoft">{prizeCaption(tournament)}</div></div>
					</div>
				</div>
			</div>

			<div className="space-y-6 p-6">
				<div className="space-y-4">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<h3 className="font-display text-xl text-cream">Команды турнира</h3>
							<p className="mt-1 text-sm text-muted">Нажмите на команду, чтобы открыть состав игроков.</p>
						</div>
						<div className="font-mono text-xs text-muted">{tournament.applications.length}/{tournament.maxTeams} команд</div>
					</div>
					<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
						{tournament.applications.map((application, index) => (
							<button key={application.id} type="button" onClick={() => setSelectedTeam(application.team)} className="group rounded-xl border border-line bg-panel/50 p-3 text-left transition hover:border-aegis/60 hover:bg-aegis/10">
								<div className="flex items-center justify-between gap-3">
									<div className="flex min-w-0 items-center gap-3">
										<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-panel2 font-mono text-xs text-aegis group-hover:border-aegis/60">{teamMark(application.team)}</span>
										<div className="min-w-0">
											<div className="truncate font-semibold text-cream">{application.team.name}</div>
											<div className="text-xs text-muted">Seed #{application.seed ?? index + 1} · {appStatusLabels[application.status] ?? application.status}</div>
										</div>
									</div>
									<div className="font-mono text-sm text-aegisSoft">{application.team.membersCount}/5</div>
								</div>
							</button>
						))}
						{tournament.applications.length === 0 && <div className="rounded-xl border border-line bg-panel/40 p-6 text-center text-muted md:col-span-2 xl:col-span-4">Команды ещё не зарегистрированы.</div>}
					</div>
				</div>

				<div className="space-y-4">
					<h3 className="font-display text-xl text-cream">Турнирная сетка</h3>
					{matchRows.length > 0 ? (
						<div className="relative overflow-hidden rounded-xl border border-line bg-panel/80 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] md:p-5">
							<div
								className="pointer-events-none absolute inset-0 opacity-90"
								aria-hidden="true"
								style={{
									background:
										'radial-gradient(circle at 82% 18%, rgba(242,207,123,0.12), transparent 42%), linear-gradient(165deg, rgba(12,14,18,0.92), rgba(20,24,30,0.88))'
								}}
							/>
							<div className="relative flex flex-col gap-4 lg:flex-row lg:items-start">
								<div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain pb-2">
									<div className="inline-flex w-max items-stretch gap-0">
										{bracketColumns.map(([round, matches], columnIndex) => {
											const next = bracketColumns[columnIndex + 1];
											const ordered = [...matches].sort((a, b) => a.position - b.position);
											const isFirst = columnIndex === 0;
											return (
												<React.Fragment key={round}>
													<div className={`flex w-[13.25rem] shrink-0 flex-col sm:w-[14rem] ${isFirst ? '' : ''}`}>
														<div className="mb-2 h-4 shrink-0 text-center text-[10px] uppercase tracking-[0.16em] text-aegisSoft">
															Раунд {round}
														</div>
														<div
															className={
																isFirst
																	? 'flex flex-col gap-3'
																	: 'flex min-h-0 flex-1 flex-col justify-around gap-3'
															}
														>
															{ordered.map((match, matchIndex) => (
																<div
																	key={match.id}
																	className="bracket-match mobile-enter"
																	style={{ animationDelay: `${columnIndex * 90 + matchIndex * 55}ms` }}
																>
																	<div className="overflow-hidden rounded-md border border-line/80 bg-ink/80 ring-1 ring-aegis/10">
																		<BracketTeam
																			team={match.teamA}
																			score={match.scoreA}
																			winner={match.winnerTeamId === match.teamA?.id}
																			canPreview={Boolean(match.teamA && match.teamB)}
																			onPreview={(el) => match.teamA && openMatchup(match, match.teamA.id, el)}
																		/>
																		<div className="border-t border-line/60" />
																		<BracketTeam
																			team={match.teamB}
																			score={match.scoreB}
																			winner={match.winnerTeamId === match.teamB?.id}
																			canPreview={Boolean(match.teamA && match.teamB)}
																			onPreview={(el) => match.teamB && openMatchup(match, match.teamB.id, el)}
																		/>
																	</div>
																	<p className="mt-1 text-center text-[10px] text-muted">
																		{matchStatusLabels[match.status] ?? match.status} · BO{match.bestOf}
																	</p>
																	<MatchTopPlayers match={match} />
																</div>
															))}
														</div>
													</div>
													{next ? <BracketSpine from={ordered.length} to={next[1].length} /> : null}
												</React.Fragment>
											);
										})}
									</div>
								</div>

								<div className="mx-auto flex w-full max-w-[11rem] shrink-0 flex-col items-center gap-3 lg:mx-0">
									<div
										className="relative flex h-28 w-28 items-center justify-center trophy-float sm:h-32 sm:w-32"
										aria-label="Aegis trophy"
									>
										<div className="aegis-aura trophy-glow" aria-hidden="true" />
										<Image
											src="/aegis-champions-mark.png"
											alt="Аегис"
											width={360}
											height={353}
											unoptimized
											priority={false}
											className="relative h-full w-full object-contain drop-shadow-[0_0_18px_rgba(242,207,123,0.35)]"
										/>
									</div>
									<div className="w-full rounded-md border border-aegis/45 bg-aegis/15 px-2 py-1.5 text-center font-display text-sm text-cream">
										{winner?.name ?? 'WINNER'}
									</div>
								</div>
							</div>
						</div>
					) : (
						<div className="rounded-xl border border-line bg-panel/40 p-6 text-center text-muted">
							Матчи появятся после регистрации команд и генерации сетки.
						</div>
					)}
				</div>
			</div>

			{selectedTeam && (
				<div className="fixed inset-x-0 bottom-0 top-16 z-30 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm animate-[modalFade_180ms_ease-out]">
					<div className="w-full max-w-2xl rounded-card border border-line bg-ink p-6 shadow-2xl animate-[modalRise_260ms_ease-out]">
						<div className="flex items-start justify-between gap-4">
							<div>
								<div className="text-xs uppercase tracking-wide text-aegisSoft">Состав команды</div>
								<h3 className="mt-1 font-display text-2xl text-cream">{selectedTeam.name}</h3>
								<p className="mt-1 text-sm text-muted">{selectedTeam.region ?? 'Регион не указан'} · {selectedTeam.membersCount}/5 игроков</p>
							</div>
							<button type="button" onClick={() => setSelectedTeam(null)} className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-cream">Закрыть</button>
						</div>

						<div className="mt-5 overflow-hidden rounded-xl border border-line bg-panel/40">
							<table className="w-full border-collapse text-left text-sm">
								<thead className="bg-panel2 text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">Игрок</th><th className="px-4 py-3">Роль</th><th className="px-4 py-3">Steam</th><th className="px-4 py-3">Статус</th></tr></thead>
								<tbody className="divide-y divide-line/70">
									{selectedTeam.members.map((member) => (
										<tr key={member.id} className="hover:bg-panel/60">
											<td className="px-4 py-3">
												<div className="flex items-center gap-3">
													{member.avatarUrl ? <Image src={member.avatarUrl} alt="" width={36} height={36} unoptimized className="h-9 w-9 rounded-full border border-line object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-panel2 font-mono text-xs text-aegis">{member.displayName.slice(0, 2)}</span>}
													<div className="font-semibold text-cream">{member.displayName}</div>
												</div>
											</td>
											<td className="px-4 py-3 text-muted">{member.role === 'captain' ? 'Капитан' : member.role}</td>
											<td className="px-4 py-3 text-muted">{member.steamId ? 'подтверждён' : 'нет'}</td>
											<td className="px-4 py-3"><StatusPill tone={member.confirmed ? 'radiant' : 'muted'}>{member.confirmed ? 'в составе' : 'ожидает'}</StatusPill></td>
										</tr>
									))}
									{selectedTeam.members.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted">Игроки ещё не добавлены.</td></tr>}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}

			<BracketMatchupPreview
				open={preview.open}
				onClose={preview.closePreview}
				teamA={preview.teamA}
				teamB={preview.teamB}
				focusTeamId={preview.focusTeamId}
				anchor={preview.anchor}
			/>
		</section>
	);
}

function BracketSpine({ from, to }: { from: number; to: number }) {
	const gradId = React.useId().replace(/:/g, '');
	const outlets = Math.max(to, 1);
	const feeders = Math.max(from, 1);
	const unit = 100;
	const vbH = outlets * unit;
	const paths: string[] = [];

	if (feeders === outlets) {
		for (let i = 0; i < outlets; i += 1) {
			const y = i * unit + unit / 2;
			paths.push(`M 0 ${y} H 28`);
		}
	} else {
		const per = Math.max(1, Math.round(feeders / outlets));
		for (let i = 0; i < outlets; i += 1) {
			const start = i * per;
			const end = Math.min(feeders, start + per) - 1;
			const yTop = ((start + 0.5) / feeders) * vbH;
			const yBot = ((end + 0.5) / feeders) * vbH;
			const yOut = i * unit + unit / 2;
			if (start === end) {
				paths.push(`M 0 ${yTop} H 14 V ${yOut} H 28`);
			} else {
				paths.push(`M 0 ${yTop} H 14 M 0 ${yBot} H 14 M 14 ${yTop} V ${yBot} M 14 ${yOut} H 28`);
			}
		}
	}

	return (
		<div className="hidden w-7 shrink-0 flex-col self-stretch sm:flex" aria-hidden="true">
			<div className="mb-2 h-4" />
			<svg className="h-full min-h-[6rem] w-full" viewBox={`0 0 28 ${vbH}`} preserveAspectRatio="none">
				<defs>
					<linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
						<stop offset="0%" stopColor="rgba(242,207,123,0.25)" />
						<stop offset="50%" stopColor="rgba(242,207,123,0.95)" />
						<stop offset="100%" stopColor="rgba(242,207,123,0.35)" />
					</linearGradient>
				</defs>
				{paths.map((d, index) => (
					<path
						key={index}
						d={d}
						fill="none"
						stroke={`url(#${gradId})`}
						strokeWidth="1.5"
						strokeLinecap="square"
						className="bracket-spine-path"
						style={{ animationDelay: `${index * 100}ms` }}
					/>
				))}
			</svg>
		</div>
	);
}

function BracketTeam({
	team,
	score,
	winner,
	canPreview = false,
	onPreview
}: {
	team: TeamLite | null;
	score: number;
	winner: boolean;
	canPreview?: boolean;
	onPreview?: (el: HTMLElement) => void;
}) {
	const className = `relative flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[11px] font-semibold transition-colors ${
		winner ? 'bg-aegis/15 text-cream' : 'bg-transparent text-cream/85'
	} ${canPreview ? 'cursor-pointer hover:bg-aegis/10 focus-visible:bg-aegis/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-aegis/50' : ''}`;

	const inner = (
		<>
			{winner ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-aegisSoft/90" /> : null}
			<div className="flex min-w-0 items-center gap-1.5">
				{team?.logo ? (
					<TeamLogo url={team.logo} name={team.name} size={20} className="h-5 w-5 rounded border border-line" />
				) : (
					<span
						className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[9px] font-mono ${
							winner ? 'border-aegis/70 bg-aegis/20 text-aegisSoft' : 'border-line bg-panel2 text-muted'
						}`}
					>
						{teamMark(team)}
					</span>
				)}
				<span className={`${winner ? 'text-aegisSoft' : ''} truncate`}>{team?.name ?? 'КОМАНДА'}</span>
			</div>
			<span className={`shrink-0 font-mono tabular-nums ${winner ? 'text-aegisSoft' : 'text-muted'}`}>{score}</span>
		</>
	);

	if (canPreview && team && onPreview) {
		return (
			<button
				type="button"
				className={className}
				aria-label={`Прогноз: ${team.name}`}
				onMouseEnter={(event) => onPreview(event.currentTarget)}
				onFocus={(event) => onPreview(event.currentTarget)}
				onClick={(event) => {
					event.stopPropagation();
					onPreview(event.currentTarget);
				}}
			>
				{inner}
			</button>
		);
	}

	return <div className={className}>{inner}</div>;
}

function MatchTopPlayers({ match }: { match: MatchLite }) {
	const teams = [match.teamA, match.teamB].filter(Boolean) as TeamLite[];
	if (!teams.some((team) => team.topPlayers.length > 0)) return null;
	const winner = teams.find((team) => team.id === match.winnerTeamId);
	const topCount = teams.reduce((sum, team) => sum + team.topPlayers.length, 0);

	return (
		<details className="mt-1 rounded border border-line/40 bg-ink/25 open:bg-ink/40">
			<summary className="cursor-pointer list-none px-2 py-1 text-[10px] text-muted marker:content-none hover:text-aegisSoft">
				Топ · {topCount}
				{winner ? ` · ${winner.tag || winner.name}` : ''}
			</summary>
			<div className="max-h-40 space-y-1.5 overflow-y-auto border-t border-line/40 p-1.5">
				{teams.map((team) =>
					team.topPlayers.slice(0, 3).map((player, index) => (
						<div key={player.id} className="flex items-center gap-1.5 text-[10px] text-muted">
							<span className="w-3 font-mono text-aegisSoft">{index + 1}</span>
							<span className="min-w-0 flex-1 truncate text-cream">{player.displayName}</span>
							<span className="font-mono">{player.kda !== null ? player.kda : player.score}</span>
						</div>
					))
				)}
			</div>
		</details>
	);
}
