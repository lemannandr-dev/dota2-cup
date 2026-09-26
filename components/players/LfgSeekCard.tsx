'use client';

import { RankMedal } from '@/components/dota/RankMedal';
import { StatusPill } from '@/components/dota/StatusPill';
import { SteamAvatar } from '@/components/desk/SteamAvatar';
import { formatStoredArenaRating } from '@/lib/arena-rating';
import { MmrGlow } from '@/components/dota/MmrGlow';
import type { PartyLfgCard } from '@/lib/party-search';
import { playerCardHref } from '@/lib/site';

const ROLE_LABELS: Record<number, string> = {
	1: '1 · Керри',
	2: '2 · Мид',
	3: '3 · Оффлейн',
	4: '4 · Поддержка',
	5: '5 · Полная поддержка'
};

type Props = {
	post: PartyLfgCard;
	isSelf: boolean;
	canInvite: boolean;
	inviteTeamName: string | null;
	onMenu: (x: number, y: number) => void;
	onInvite: () => void;
	onEdit: () => void;
	onClose: () => void;
};

function formatRemaining(iso: string) {
	const ms = new Date(iso).getTime() - Date.now();
	if (ms <= 0) return 'истекает';
	const hours = Math.floor(ms / 3_600_000);
	const minutes = Math.floor((ms % 3_600_000) / 60_000);
	if (hours >= 1) return `${hours} ч ${minutes} мин`;
	return `${Math.max(1, minutes)} мин`;
}

function formatMmrRange(min: number | null, max: number | null) {
	if (min == null && max == null) return null;
	if (min != null && max != null) return `${min}–${max} MMR`;
	if (min != null) return `от ${min} MMR`;
	return `до ${max} MMR`;
}

export function LfgSeekCard({ post, isSelf, canInvite, inviteTeamName, onMenu, onInvite, onEdit, onClose }: Props) {
	const mmr = formatMmrRange(post.mmrMin, post.mmrMax);
	const arena = formatStoredArenaRating(post.user.rating, post.user.ratingGames ?? 0);
	const wanted = [1, 2, 3, 4, 5].filter((role) => post.roles.includes(role));
	const roleHint = wanted.length === 5 ? 'любая позиция' : wanted.map((role) => ROLE_LABELS[role]).join(' · ');

	return (
		<article
			onContextMenu={(event) => {
				event.preventDefault();
				event.stopPropagation();
				onMenu(event.clientX, event.clientY);
			}}
			className={`obsidian-glass card-hover rounded-card p-4 ${isSelf ? 'ring-1 ring-aegis/40' : ''}`}
		>
			<div className="flex items-start gap-3">
				<a href={playerCardHref(post.user.id)} className="relative shrink-0" title="Визитка">
					<SteamAvatar
						url={post.user.avatarUrl}
						name={post.user.displayName}
						className={`h-14 w-14 border ${post.isOnline ? 'border-radiant/70' : 'border-line'}`}
					/>
					<span
						aria-hidden="true"
						className={`absolute bottom-0.5 left-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink ${post.isOnline ? 'bg-radiant' : 'bg-muted'}`}
					/>
				</a>
				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-2">
						<div className="min-w-0">
							<div className="flex min-w-0 flex-wrap items-center gap-2">
								<a href={playerCardHref(post.user.id)} className="truncate font-display text-lg text-cream hover:text-aegisSoft">
									{post.user.displayName}
								</a>
								{post.mmr && <MmrGlow mmr={post.mmr} size="xs" />}
								<StatusPill tone={post.isOnline ? 'radiant' : 'muted'} compact>
									{post.isOnline ? 'на арене' : 'оффлайн'}
								</StatusPill>
								{isSelf && (
									<StatusPill tone="aegis" compact>
										ваша заявка
									</StatusPill>
								)}
							</div>
							{post.medal && (
								<div className="mt-1.5">
									<RankMedal
										tier={post.medal.tier}
										stars={post.medal.stars}
										leaderboard={post.medal.leaderboard}
										size={28}
										showLabel
									/>
								</div>
							)}
							<p className="mt-1 text-xs text-muted">арена {arena}</p>
						</div>
						<button
							type="button"
							aria-label="Действия заявки"
							onClick={(event) => {
								const rect = event.currentTarget.getBoundingClientRect();
								onMenu(rect.right - 240, rect.bottom + 6);
							}}
							className="rounded-lg border border-line px-2 py-1 text-sm text-muted hover:text-cream"
						>
							⋯
						</button>
					</div>
					{post.tournament ? (
						<a
							href={post.tournament.href}
							className="mt-2 inline-flex items-center rounded-full border border-aegis/40 bg-aegis/10 px-2.5 py-1 text-xs text-aegisSoft hover:border-aegis"
						>
							{post.tournament.title}
						</a>
					) : null}
				</div>
			</div>

			<div className="mt-3" role="list" aria-label={roleHint}>
				<div className="flex gap-1.5">
					{[1, 2, 3, 4, 5].map((role) => {
						const on = post.roles.includes(role);
						return (
							<span
								key={role}
								role="listitem"
								title={ROLE_LABELS[role]}
								className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold ${
									on ? 'bg-aegis text-ink' : 'border border-line text-muted'
								}`}
							>
								{role}
							</span>
						);
					})}
				</div>
				<p className="mt-1.5 text-xs text-muted">{roleHint}</p>
			</div>

			{post.note ? (
				<p className="mt-3 text-sm leading-6 text-cream">«{post.note}»</p>
			) : (
				<p className="mt-3 text-sm text-muted">Без комментария</p>
			)}

			<div className="mt-3 flex flex-col gap-3 border-t border-line/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
				<p className="text-xs text-muted">
					ещё {formatRemaining(post.expiresAt)}
					{mmr ? ` · ${mmr}` : ''}
				</p>
				<div className="flex flex-wrap gap-2">
					{isSelf ? (
						<>
							<button
								type="button"
								onClick={onEdit}
								className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-cream hover:border-aegis"
							>
								Изменить
							</button>
							<button
								type="button"
								onClick={onClose}
								className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-muted hover:text-cream"
							>
								Снять
							</button>
						</>
					) : canInvite ? (
						<button
							type="button"
							onClick={onInvite}
							className="inline-flex min-h-11 max-w-full items-center truncate rounded-full bg-aegis px-4 text-sm font-semibold text-ink hover:bg-aegisSoft"
						>
							{inviteTeamName ? `В «${inviteTeamName}»` : 'Пригласить'}
						</button>
					) : (
						<a
							href={playerCardHref(post.user.id)}
							className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-cream hover:border-aegis"
						>
							Визитка
						</a>
					)}
				</div>
			</div>
		</article>
	);
}
