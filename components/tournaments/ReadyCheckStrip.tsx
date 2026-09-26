'use client';

import Link from 'next/link';
import type { ReadyCheckBoard, ReadySlot } from '@/lib/ready-check';
import { SteamAvatar } from '@/components/desk/SteamAvatar';
import { RankMedal } from '@/components/dota/RankMedal';

function Slot({ slot, compact }: { slot: ReadySlot; compact?: boolean }) {
	const size = compact ? 'h-8 w-8' : 'h-11 w-11 sm:h-12 sm:w-12';
	const tone =
		slot.state === 'ready'
			? 'ready-slot-pop border-[#3DDC84] bg-[#1B5E20] shadow-[0_0_12px_rgba(61,220,132,0.5)]'
			: slot.state === 'pending'
				? 'ready-wait border-[#F5D76E] bg-[#3A2F0B]'
				: slot.state === 'declined'
					? 'border-red-400/50 bg-red-950/60'
					: 'border-white/10 bg-black/50';
	const tip = [slot.displayName ?? 'Слот пуст', slot.rankLabel].filter(Boolean).join(' · ');

	const body = (
		<div className="ready-player-chip">
			<div className="relative">
				<div className={`relative overflow-hidden rounded-lg border transition-[background-color,border-color,box-shadow] duration-200 ${size} ${tone}`} title={tip}>
					{slot.avatarUrl ? (
						<SteamAvatar
							url={slot.avatarUrl}
							name={slot.displayName || '?'}
							className={`h-full w-full ${slot.state === 'empty' ? 'opacity-20' : ''}`}
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center text-[10px] text-white/70">
							{slot.displayName ? slot.displayName.slice(0, 1).toUpperCase() : ''}
						</div>
					)}
				</div>
				{slot.medal && slot.state !== 'empty' ? (
					<span className="absolute -bottom-1 -right-1 rounded-full bg-ink/90 p-px ring-1 ring-line/80">
						<RankMedal
							tier={slot.medal.tier}
							stars={slot.medal.stars}
							leaderboard={slot.medal.leaderboard}
							size={compact ? 16 : 20}
							showLabel={false}
						/>
					</span>
				) : null}
			</div>
			{!compact && slot.displayName ? <span className="name">{slot.displayName}</span> : null}
		</div>
	);

	if (!slot.displayName || slot.state === 'empty') {
		return <div className="ready-player-chip opacity-40">{body}</div>;
	}

	if (slot.profileHref) {
		return (
			<Link
				href={slot.profileHref}
				className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-aegis/60"
				aria-label={tip}
			>
				{body}
			</Link>
		);
	}

	return body;
}

function Side({ side, compact }: { side: ReadyCheckBoard['sideA']; compact: boolean }) {
	const ready = side.slots.filter((s) => s.state === 'ready').length;
	return (
		<div className="space-y-2 rounded-lg border border-line/60 bg-black/25 p-2.5 mobile-enter">
			<div className="flex items-center justify-between gap-2">
				<div className={`min-w-0 truncate font-semibold text-cream ${compact ? 'text-[10px]' : 'text-xs'}`} title={side.teamName ?? 'Команда'}>
					{side.teamName ?? 'Команда'}
				</div>
				<div className={`shrink-0 font-mono tabular-nums ${ready === 5 ? 'text-radiant' : 'text-aegisSoft'} ${compact ? 'text-[10px]' : 'text-xs'}`}>
					{ready}/5
				</div>
			</div>
			<div className="flex justify-between gap-1 overflow-x-auto pb-0.5">
				{side.slots.map((slot, index) => (
					<Slot key={slot.userId ?? `${side.teamName}-${index}`} slot={slot} compact={compact} />
				))}
			</div>
		</div>
	);
}

export function ReadyCheckStrip({
	board,
	compact = false
}: {
	board: ReadyCheckBoard;
	compact?: boolean;
}) {
	return (
		<div data-ready-check className={compact ? 'space-y-1.5' : 'space-y-2.5'}>
			<div className="flex items-center justify-between gap-3">
				<div className={`uppercase tracking-[0.16em] text-white/70 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
					Состав пятёрок
				</div>
				<div className={`font-semibold uppercase tracking-wide text-cream ${compact ? 'text-[10px]' : 'text-xs'}`}>
					{board.label}
				</div>
			</div>
			<div className="grid gap-2 lg:grid-cols-2">
				<Side side={board.sideA} compact={compact} />
				<Side side={board.sideB} compact={compact} />
			</div>
			{!compact && <p className="text-[11px] leading-4 text-muted">{board.hint}</p>}
		</div>
	);
}
