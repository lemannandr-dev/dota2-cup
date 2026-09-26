'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SteamAvatar } from '@/components/desk/SteamAvatar';
import { RankMedal } from '@/components/dota/RankMedal';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { HeroMedia } from '@/components/heroes/HeroMedia';
import { buildTeamMatchup, type MatchupTeam, type TeamMatchup } from '@/lib/bracket-matchup';
import { haptic } from '@/lib/haptics';

type Props = {
	open: boolean;
	onClose: () => void;
	teamA: MatchupTeam | null;
	teamB: MatchupTeam | null;
	focusTeamId: string | null;
	anchor?: DOMRect | null;
};

function SideList({
	title,
	winPct,
	edges,
	highlight
}: {
	title: string;
	winPct: number;
	edges: TeamMatchup['sideA'];
	highlight: boolean;
}) {
	return (
		<div className={`space-y-2 rounded-lg border p-2.5 ${highlight ? 'border-aegis/50 bg-aegis/10' : 'border-line/70 bg-black/20'}`}>
			<div className="flex items-center justify-between gap-2">
				<p className="truncate text-xs font-semibold text-cream">{title}</p>
				<span className="shrink-0 font-mono text-sm text-aegisSoft">{winPct}%</span>
			</div>
			<ul className="space-y-1.5">
				{edges.map((edge) => (
					<li key={edge.playerId} className="flex items-center gap-2">
						<SteamAvatar url={edge.avatarUrl} name={edge.displayName} className="h-8 w-8" />
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-1.5">
								<span className="truncate text-[11px] font-semibold text-cream">{edge.displayName}</span>
								{edge.medal ? (
									<RankMedal
										tier={edge.medal.tier}
										stars={edge.medal.stars}
										leaderboard={edge.medal.leaderboard}
										size={16}
										showLabel={false}
									/>
								) : null}
							</div>
							<p className="truncate text-[10px] text-muted">
								{edge.mmrLabel ?? 'нет кэша'} · vs состава {Math.round(edge.winChanceVsOpp * 100)}%
							</p>
							{edge.heroes.length > 0 ? (
								<div className="mt-1 flex gap-1">
									{edge.heroes.map((hero) =>
										hero.image ? (
											<span key={hero.heroId} title={`${hero.name ?? hero.heroId} · ур. ${hero.level}`} className="relative">
												<HeroMedia
													src={hero.image}
													alt={hero.name ?? `Герой ${hero.heroId}`}
													width={28}
													height={16}
													className="h-4 w-7 rounded object-cover"
												/>
												<span className="absolute -bottom-0.5 -right-0.5 rounded bg-ink/90 px-0.5 font-mono text-[8px] text-aegisSoft">
													{hero.level}
												</span>
											</span>
										) : null
									)}
								</div>
							) : null}
						</div>
					</li>
				))}
				{edges.length === 0 ? <li className="text-[11px] text-muted">Состав ещё не известен</li> : null}
			</ul>
		</div>
	);
}

function MatchupBody({ matchup, focusTeamId, teamAName, teamBName }: { matchup: TeamMatchup; focusTeamId: string | null; teamAName: string; teamBName: string }) {
	return (
		<div className="space-y-3">
			<div className="h-2 overflow-hidden rounded-full bg-panel2">
				<div className="h-full bg-gradient-to-r from-aegis to-radiant transition-[width] duration-300" style={{ width: `${matchup.teamAWinPct}%` }} />
			</div>
			<p className="text-center text-[11px] text-muted">
				{teamAName} {matchup.teamAWinPct}% · {teamBName} {matchup.teamBWinPct}%
			</p>
			<div className="grid gap-2 sm:grid-cols-2">
				<SideList title={teamAName} winPct={matchup.teamAWinPct} edges={matchup.sideA} highlight={focusTeamId === matchup.teamAId} />
				<SideList title={teamBName} winPct={matchup.teamBWinPct} edges={matchup.sideB} highlight={focusTeamId === matchup.teamBId} />
			</div>
			<p className="text-[10px] leading-4 text-muted">{matchup.hint}</p>
		</div>
	);
}

export function BracketMatchupPreview({ open, onClose, teamA, teamB, focusTeamId, anchor }: Props) {
	const titleId = useId();
	const panelRef = useRef<HTMLDivElement>(null);
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const mq = window.matchMedia('(max-width: 767px)');
		const sync = () => setIsMobile(mq.matches);
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	}, []);

	useEffect(() => {
		if (!open || isMobile) return;

		function onKey(event: KeyboardEvent) {
			if (event.key === 'Escape') onClose();
		}

		function onPointer(event: MouseEvent) {
			const target = event.target as Node | null;
			if (!target) return;
			if (panelRef.current?.contains(target)) return;
			if (target instanceof Element && target.closest('button[aria-label^="Прогноз:"]')) return;
			onClose();
		}

		const timer = window.setTimeout(() => {
			document.addEventListener('keydown', onKey);
			document.addEventListener('mousedown', onPointer);
		}, 0);

		return () => {
			window.clearTimeout(timer);
			document.removeEventListener('keydown', onKey);
			document.removeEventListener('mousedown', onPointer);
		};
	}, [open, isMobile, onClose]);

	if (!open || !teamA || !teamB) return null;

	const matchup = buildTeamMatchup(teamA, teamB);
	const title = `${teamA.name} vs ${teamB.name}`;

	if (isMobile) {
		return (
			<BottomSheet open={open} onClose={onClose} title={title} description="Прогноз по кэшу OpenDota / арены и Plus-пулу">
				<MatchupBody matchup={matchup} focusTeamId={focusTeamId} teamAName={teamA.name} teamBName={teamB.name} />
			</BottomSheet>
		);
	}

	const top = Math.min((anchor?.bottom ?? 80) + 8, typeof window !== 'undefined' ? window.innerHeight - 360 : 80);
	const left = Math.min(Math.max(12, (anchor?.left ?? 12) - 40), typeof window !== 'undefined' ? window.innerWidth - 380 : 12);

	return createPortal(
		<div
			ref={panelRef}
			role="dialog"
			aria-modal="false"
			aria-labelledby={titleId}
			className="fixed z-[80] w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-aegis/40 bg-ink/95 p-3 shadow-2xl backdrop-blur-md fade-up"
			style={{ top, left }}
		>
			<div className="mb-2 flex items-start justify-between gap-2">
				<h3 id={titleId} className="font-display text-sm text-cream">
					{title}
				</h3>
				<button type="button" onClick={onClose} className="rounded-md border border-line px-2 py-1 text-[10px] text-muted hover:text-cream" aria-label="Закрыть">
					✕
				</button>
			</div>
			<MatchupBody matchup={matchup} focusTeamId={focusTeamId} teamAName={teamA.name} teamBName={teamB.name} />
		</div>,
		document.body
	);
}

export function useBracketMatchupPreview() {
	const [state, setState] = useState<{
		open: boolean;
		teamA: MatchupTeam | null;
		teamB: MatchupTeam | null;
		focusTeamId: string | null;
		anchor: DOMRect | null;
	}>({ open: false, teamA: null, teamB: null, focusTeamId: null, anchor: null });

	function openPreview(input: { teamA: MatchupTeam | null; teamB: MatchupTeam | null; focusTeamId: string; anchor: DOMRect | null }) {
		if (!input.teamA || !input.teamB) return;
		haptic('tap');
		setState({ open: true, ...input });
	}

	function closePreview() {
		setState((prev) => ({ ...prev, open: false }));
	}

	return { ...state, openPreview, closePreview };
}
