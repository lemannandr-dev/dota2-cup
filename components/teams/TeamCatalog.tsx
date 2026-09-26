'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { RankMedal } from '@/components/dota/RankMedal';
import { StatusPill } from '@/components/dota/StatusPill';
import { MatchScoreForm } from '@/components/tournaments/MatchScoreForm';
import { SteamAvatar } from '@/components/desk/SteamAvatar';
import { TeamCreateForm } from '@/components/teams/TeamCreateForm';
import { TeamLogo } from '@/components/teams/TeamLogo';
import type { RosterSlotPlayer } from '@/lib/team-roster';
import { partySearchHref } from '@/lib/team-roster';
import { isHostedTeamVideo } from '@/lib/team-cover';
import { medalCaption } from '@/lib/dota-rank';

export type TeamCardData = {
	id: string;
	name: string;
	tag: string | null;
	game: string;
	description: string | null;
	logo: string | null;
	bannerUrl: string | null;
	videoUrl: string | null;
	contactUrl: string | null;
	region: string | null;
	language: string | null;
	playstyle: string | null;
	goals: string | null;
	recruitmentStatus: string;
	createdById: string;
	captainName: string;
	confirmed: number;
	ready: boolean;
	membersCount: number;
	membersWithStats: number;
	teamWinRate: number | null;
	wins: number;
	losses: number;
	cups: Array<{ id: string; title: string; href: string; statusLabel: string; result: string }>;
	avgMmr: number | null;
	avgKda: string | null;
	topRoles: string[];
	roster: RosterSlotPlayer[];
	members: Array<{ id: string; displayName: string; statusLabel: string; confirmed: boolean }>;
};

type FriendBonds = { friends: string[]; outgoing: string[]; incoming: string[] };

type Props = {
	teams: TeamCardData[];
	currentUserId: string | null;
	bonds?: FriendBonds;
};

type ChallengeDetails = {
	id: string;
	fromUserId: string;
	toUserId: string;
	fromTeamId: string;
	toTeamId: string;
	message: string | null;
	status: string;
	scheduledAt: string | null;
	createdAt: string;
	match?: { id: string; status: string; scoreA: number; scoreB: number } | null;
	fromTeam: { id: string; name: string; tag: string | null; createdById?: string | null } | null;
	toTeam: { id: string; name: string; tag: string | null; createdById?: string | null } | null;
	canReport?: boolean;
};

const recruitmentLabels: Record<string, string> = {
	OPEN: 'Открыт набор',
	INVITE_ONLY: 'Только приглашения',
	CLOSED: 'Состав закрыт'
};

const challengeStatusLabels: Record<string, string> = {
	PENDING: 'Ожидает ответа',
	ACCEPTED: 'Принят',
	DECLINED: 'Отклонён',
	COUNTERED: 'Предложено другое время'
};

const crestHues = [18, 32, 46, 168, 198, 262];

function crestHue(name: string) {
	const index = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % crestHues.length;
	return crestHues[index] ?? 32;
}

function cupsWord(count: number) {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) return 'кубок';
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'кубка';
	return 'кубков';
}

function seatsWord(count: number) {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) return 'место';
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'места';
	return 'мест';
}

function steamProfileHref(steamId?: string | null) {
	return steamId && /^[0-9]{17}$/.test(steamId) ? `https://steamcommunity.com/profiles/${steamId}` : null;
}

function friendLabel(view: 'self' | 'friends' | 'outgoing' | 'incoming' | 'none') {
	if (view === 'friends') return 'в друзьях';
	if (view === 'outgoing') return 'запрос отправлен';
	if (view === 'incoming') return 'принять';
	if (view === 'self') return '';
	return 'в друзья';
}

function PlayerFace({
	member,
	onPeek,
	onHide
}: {
	member: RosterSlotPlayer;
	onPeek: (member: RosterSlotPlayer, anchor: DOMRect) => void;
	onHide: () => void;
}) {
	return (
		<a
			href={member.href}
			className="flex flex-col items-center gap-1 text-center hover:opacity-90"
			onMouseEnter={(event) => onPeek(member, event.currentTarget.getBoundingClientRect())}
			onMouseLeave={onHide}
		>
			<span className="relative">
				<SteamAvatar url={member.avatarUrl} name={member.displayName} className="h-10 w-10 border border-line" />
				{member.medal && (
					<span className="absolute -bottom-1 -right-2">
						<RankMedal
							tier={member.medal.tier}
							stars={member.medal.stars}
							leaderboard={member.medal.leaderboard}
							size={18}
							showLabel={false}
						/>
					</span>
				)}
			</span>
			<span className="w-full truncate text-[10px] leading-4 text-cream">{member.displayName}</span>
		</a>
	);
}

function FaceRow({
	roster,
	inviteTeamId,
	onPeek,
	onHide
}: {
	roster: RosterSlotPlayer[];
	inviteTeamId?: string;
	onPeek: (member: RosterSlotPlayer, anchor: DOMRect) => void;
	onHide: () => void;
}) {
	const slots = Array.from({ length: 5 }, (_, index) => roster[index] ?? null);
	const invite = inviteTeamId ? partySearchHref({ teamId: inviteTeamId, tab: 'players' }) : null;
	return (
		<ul className="grid grid-cols-5 gap-1.5">
			{slots.map((member, index) => (
				<li key={member?.id ?? `empty-${index}`} className="min-w-0">
					{member ? (
						<PlayerFace member={member} onPeek={onPeek} onHide={onHide} />
					) : invite ? (
						<a href={invite} aria-label="пригласить" className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-aegis/50 text-sm text-aegisSoft">
							+
						</a>
					) : (
						<span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-line/80 text-muted">·</span>
					)}
				</li>
			))}
		</ul>
	);
}

function CoverField({ label, accept, busy, onFile }: { label: string; accept: string; busy: boolean; onFile: (file: File) => void }) {
	return (
		<label className="cursor-pointer rounded-full border border-line bg-ink/80 px-2 py-1 text-[10px] text-cream hover:border-aegis">
			{busy ? '...' : label}
			<input
				type="file"
				accept={accept}
				className="sr-only"
				disabled={busy}
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = '';
					if (file) onFile(file);
				}}
			/>
		</label>
	);
}

function TeamBoard({
	team,
	isMine,
	signedIn,
	onPeek,
	onHide,
	onEdit,
	onChallenge,
	canChallenge,
	onUpload
}: {
	team: TeamCardData;
	isMine: boolean;
	signedIn: boolean;
	onPeek: (member: RosterSlotPlayer, anchor: DOMRect) => void;
	onHide: () => void;
	onEdit: () => void;
	onChallenge: () => void;
	canChallenge: boolean;
	onUpload: (slot: 'logo' | 'cover', file: File) => Promise<string | null>;
}) {
	const hue = crestHue(team.name);
	const openSeats = Math.max(0, 5 - team.confirmed);
	const recruiting = team.recruitmentStatus === 'OPEN' && openSeats > 0;
	const [bannerFailed, setBannerFailed] = useState(false);
	const [uploadSlot, setUploadSlot] = useState<'logo' | 'cover' | null>(null);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const banner = team.bannerUrl && !bannerFailed ? team.bannerUrl : null;
	const hostedVideo = isHostedTeamVideo(team.videoUrl);
	async function upload(slot: 'logo' | 'cover', file: File) {
		setUploadSlot(slot);
		setUploadError(null);
		const error = await onUpload(slot, file);
		setUploadSlot(null);
		setUploadError(error);
	}
	return (
		<div className="group relative h-[22.5rem]">
			<article className={`obsidian-glass flex h-full min-w-0 flex-col overflow-visible rounded-card ${recruiting ? 'ring-1 ring-aegis/35' : ''}`}>
				<div className="relative h-24 shrink-0 overflow-hidden rounded-t-[inherit]">
					{hostedVideo && team.videoUrl ? (
						<video src={team.videoUrl} className="h-full w-full object-cover" autoPlay muted loop playsInline />
					) : banner ? (
						// Native img so a dead banner falls back to the crest gradient.
						// eslint-disable-next-line @next/next/no-img-element
						<img src={banner} alt="" className="h-full w-full object-cover" onError={() => setBannerFailed(true)} />
					) : (
						<div
							className="h-full w-full"
							style={{ background: `linear-gradient(135deg, hsl(${hue} 46% 22%), hsl(${hue} 28% 10%) 58%, #100c09)` }}
						/>
					)}
					<div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-transparent" />
					{isMine && (
						<div className="absolute right-2 top-2 flex items-center gap-1">
							<span className="rounded-full border border-radiant/40 bg-ink/80 px-2 py-0.5 text-[11px] text-radiant">моя</span>
							<CoverField label="Обложка" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" busy={uploadSlot === 'cover'} onFile={(file) => void upload('cover', file)} />
						</div>
					)}
				</div>
				<div className="flex min-h-0 flex-1 flex-col px-4 pb-3">
					<div className="relative z-10 -mt-5 flex h-16 items-end justify-between gap-3">
						<div className="relative">
							<TeamLogo url={team.logo} name={team.name} size={64} className="h-16 w-16 rounded-2xl border-2 border-aegis/60 bg-ink shadow-lg" />
							{isMine && (
								<span className="absolute -bottom-1 left-1/2 -translate-x-1/2">
									<CoverField label="Знак" accept="image/png,image/jpeg,image/webp,image/gif" busy={uploadSlot === 'logo'} onFile={(file) => void upload('logo', file)} />
								</span>
							)}
						</div>
						{team.avgMmr !== null ? (
							<div className="pb-1 text-right">
								<div className="font-display text-2xl leading-none text-cream">{team.avgMmr.toLocaleString('ru-RU')}</div>
								<div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">MMR</div>
							</div>
						) : (
							<div className="h-10" />
						)}
					</div>
					<div className="mt-3 flex h-7 items-center gap-2">
						<h2 className="truncate font-display text-xl text-cream">{team.name}</h2>
						{team.tag && <span className="shrink-0 rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-muted">{team.tag}</span>}
					</div>
					<div className="mt-2 flex h-6 items-center gap-1.5 overflow-hidden">
						<StatusPill tone={recruiting ? 'aegis' : team.ready ? 'radiant' : 'muted'} compact>
							{recruiting ? `${openSeats} ${seatsWord(openSeats)}` : team.ready ? '5/5' : recruitmentLabels[team.recruitmentStatus] ?? team.recruitmentStatus}
						</StatusPill>
						{team.region && <span className="rounded-full bg-panel2 px-2 py-0.5 text-[11px] text-muted">{team.region}</span>}
						{team.language && <span className="rounded-full bg-panel2 px-2 py-0.5 text-[11px] text-muted">{team.language}</span>}
					</div>
					<p className="mt-2 truncate text-[11px] text-muted">
						{team.wins + team.losses > 0 ? `${team.wins}–${team.losses}${team.teamWinRate !== null ? ` · ${team.teamWinRate}%` : ''}` : team.cups.length > 0 ? 'счёта ещё нет' : 'пар ещё нет'}
						{team.cups.length > 0 ? ` · ${team.cups.length} ${cupsWord(team.cups.length)}` : ''}
						{team.cups[0] ? ` · ${team.cups[0].title}` : ''}
					</p>
					<div className="mt-auto pt-3">
						<FaceRow roster={team.roster} inviteTeamId={isMine ? team.id : undefined} onPeek={onPeek} onHide={onHide} />
					</div>
					<div className="mt-3 flex h-9 items-center justify-end">
						{isMine ? (
							<button type="button" onClick={onEdit} className="rounded-full border border-line px-3 py-2 text-xs font-semibold text-cream transition hover:border-aegis">Редактировать</button>
						) : signedIn && canChallenge ? (
							<button type="button" onClick={onChallenge} className="rounded-full border border-aegis/50 bg-aegis/10 px-3 py-2 text-xs font-semibold text-aegisSoft transition hover:border-aegis">Вызвать</button>
						) : !signedIn ? (
							<a href="/api/auth/steam" className="rounded-full border border-aegis/50 bg-aegis/10 px-3 py-2 text-xs font-semibold text-aegisSoft transition hover:border-aegis">Войти</a>
						) : null}
					</div>
					{uploadError && <p className="truncate text-[10px] text-dire">{uploadError}</p>}
				</div>
			</article>
			<div className="pointer-events-none absolute inset-x-0 top-full z-20 pt-2 opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
				<div className="obsidian-glass space-y-2 rounded-card p-3 text-sm shadow-2xl">
					<div className="text-[10px] uppercase tracking-[0.14em] text-muted">Капитан · {team.captainName}</div>
					<p className="line-clamp-3 text-cream">{team.description || 'Пока без описания.'}</p>
					{(team.playstyle || team.goals) && (
						<p className="line-clamp-2 text-xs text-muted">{[team.playstyle, team.goals].filter(Boolean).join(' · ')}</p>
					)}
					{team.cups.length > 0 && (
						<ul className="space-y-1.5">
							{team.cups.slice(0, 3).map((cup) => (
								<li key={cup.id}>
									<a href={cup.href} className="block hover:text-aegisSoft">
										<span className="block truncate text-xs text-cream">{cup.title}</span>
										<span className="block truncate text-[11px] text-muted">{cup.statusLabel} · {cup.result}</span>
									</a>
								</li>
							))}
						</ul>
					)}
					<div className="flex flex-wrap items-center gap-2">
						{team.contactUrl && <ContactLink url={team.contactUrl} compact />}
						{team.videoUrl && !hostedVideo && (
							<a href={team.videoUrl} className="text-xs font-semibold text-aegisSoft hover:text-aegis">Видео</a>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

function getContactMeta(url: string) {
	const normalized = url.toLowerCase();
	if (normalized.includes('discord.gg') || normalized.includes('discord.com')) {
		return { label: 'Discord', mark: 'DC', className: 'border-indigo-400/50 bg-indigo-500/15 text-indigo-200' };
	}
	if (normalized.includes('t.me') || normalized.includes('telegram.')) {
		return { label: 'Telegram', mark: 'TG', className: 'border-sky-400/50 bg-sky-500/15 text-sky-200' };
	}
	if (normalized.includes('vk.com')) {
		return { label: 'VK', mark: 'VK', className: 'border-blue-400/50 bg-blue-500/15 text-blue-200' };
	}
	if (normalized.includes('twitch.tv')) {
		return { label: 'Twitch', mark: 'TW', className: 'border-purple-400/50 bg-purple-500/15 text-purple-200' };
	}
	if (normalized.includes('youtube.com') || normalized.includes('youtu.be')) {
		return { label: 'YouTube', mark: 'YT', className: 'border-red-400/50 bg-red-500/15 text-red-200' };
	}
	if (normalized.includes('steamcommunity.com')) {
		return { label: 'Steam', mark: 'ST', className: 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200' };
	}
	return { label: 'Сайт', mark: 'WEB', className: 'border-aegis/50 bg-aegis/10 text-aegisSoft' };
}

function ContactLink({ url, compact = false }: { url: string; compact?: boolean }) {
	const contact = getContactMeta(url);
	return (
		<a href={url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition hover:border-aegis hover:text-aegis ${contact.className}`}>
			<span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-black/20 px-1.5 font-mono text-[10px] leading-none">
				{contact.mark}
			</span>
			<span>{compact ? contact.label : `Связь через ${contact.label}`}</span>
		</a>
	);
}

export function TeamCatalog({ teams, currentUserId, bonds = { friends: [], outgoing: [], incoming: [] } }: Props) {
	const [tab, setTab] = useState<'mine' | 'all'>('all');
	const [recruitingOnly, setRecruitingOnly] = useState(false);
	const [cards, setCards] = useState(teams);
	const [friendState, setFriendState] = useState(bonds);
	const [peek, setPeek] = useState<{ member: RosterSlotPlayer; left: number; top: number } | null>(null);
	const peekTimer = useRef<number | null>(null);
	useEffect(() => setCards(teams), [teams]);
	const [menu, setMenu] = useState<{ x: number; y: number; team: TeamCardData } | null>(null);
	const [createOpen, setCreateOpen] = useState(false);
	const [createProgress, setCreateProgress] = useState(0);
	const [createReady, setCreateReady] = useState(false);
	const [challengeTeam, setChallengeTeam] = useState<TeamCardData | null>(null);
	const [editingTeam, setEditingTeam] = useState<TeamCardData | null>(null);
	const [openedChallenge, setOpenedChallenge] = useState<ChallengeDetails | null>(null);
	const [challengeDetailsLoading, setChallengeDetailsLoading] = useState(false);
	const [challengeActionStatus, setChallengeActionStatus] = useState<string | null>(null);
	const [counterMessage, setCounterMessage] = useState('');
	const [counterTime, setCounterTime] = useState('');
	const [fromTeamId, setFromTeamId] = useState('');
	const [message, setMessage] = useState('');
	const [status, setStatus] = useState<string | null>(null);
	const myTeams = useMemo(() => cards.filter((team) => team.createdById === currentUserId), [cards, currentUserId]);
	const pool = tab === 'mine' ? myTeams : cards;
	const recruitingCount = pool.filter((team) => team.recruitmentStatus === 'OPEN' && team.confirmed < 5).length;
	const visibleTeams = recruitingOnly ? pool.filter((team) => team.recruitmentStatus === 'OPEN' && team.confirmed < 5) : pool;
	const showCreateForm = createReady || createProgress >= 100;

	const openChallengeDetails = useCallback(async (id: string) => {
		setChallengeDetailsLoading(true);
		setChallengeActionStatus(null);
		const res = await fetch(`/api/teams/challenges/${id}`, { cache: 'no-store' });
		const data = await res.json().catch(() => null);
		setChallengeDetailsLoading(false);
		if (!res.ok || !data?.challenge) {
			setChallengeActionStatus(data?.error ?? 'Не удалось открыть вызов.');
			return;
		}
		setOpenedChallenge(data.challenge);
		setCounterMessage(data.challenge.message ?? '');
		setCounterTime(data.challenge.scheduledAt ? data.challenge.scheduledAt.slice(0, 16) : '');
	}, []);

	useEffect(() => {
		const challengeId = new URLSearchParams(window.location.search).get('challenge');
		if (!challengeId) return;
		void openChallengeDetails(challengeId);
	}, [openChallengeDetails]);

	async function answerChallenge(action: 'ACCEPTED' | 'DECLINED' | 'COUNTERED') {
		if (!openedChallenge) return;
		setChallengeActionStatus('Сохраняем ответ...');
		const res = await fetch(`/api/teams/challenges/${openedChallenge.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action,
				message: counterMessage,
				scheduledAt: action === 'COUNTERED' && counterTime ? new Date(counterTime).toISOString() : undefined
			})
		});
		const data = await res.json().catch(() => null);
		if (!res.ok) {
			setChallengeActionStatus(data?.error ?? 'Не удалось обработать вызов.');
			return;
		}
		await openChallengeDetails(openedChallenge.id);
		setChallengeActionStatus(action === 'ACCEPTED' ? 'Вызов принят. Это пара арены без приза.' : action === 'DECLINED' ? 'Вызов отклонён. Соперник получил уведомление.' : 'Предложение по времени отправлено сопернику.');
	}

	function closeChallengeDetails() {
		setOpenedChallenge(null);
		setChallengeActionStatus(null);
		const url = new URL(window.location.href);
		url.searchParams.delete('challenge');
		window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
	}

	useEffect(() => {
		if (!createOpen) {
			setCreateProgress(0);
			setCreateReady(false);
			return;
		}

		setCreateProgress(0);
		setCreateReady(false);
		const timer = window.setInterval(() => {
			setCreateProgress((value) => {
				const next = Math.min(100, value + 4 + Math.floor(Math.random() * 9));
				if (next >= 100) {
					window.clearInterval(timer);
					window.setTimeout(() => setCreateReady(true), 260);
				}
				return next;
			});
		}, 70);
		const finishTimer = window.setTimeout(() => {
			window.clearInterval(timer);
			setCreateProgress(100);
			window.setTimeout(() => setCreateReady(true), 220);
		}, 1800);

		return () => {
			window.clearInterval(timer);
			window.clearTimeout(finishTimer);
		};
	}, [createOpen]);

	function openMenu(event: React.MouseEvent, team: TeamCardData) {
		event.preventDefault();
		setMenu({ x: event.clientX, y: event.clientY, team });
		setStatus(null);
	}

	async function sendChallenge() {
		if (!challengeTeam || !fromTeamId) return;
		setStatus('Отправляем вызов...');
		const res = await fetch('/api/teams/challenges', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ fromTeamId, toTeamId: challengeTeam.id, message })
		});
		const data = await res.json().catch(() => null);
		if (!res.ok) {
			setStatus(data?.error ?? 'Не удалось отправить вызов.');
			return;
		}
		setStatus('Вызов отправлен лидеру команды.');
		setMessage('');
	}

	function selectChallenge(team: TeamCardData) {
		setMenu(null);
		setChallengeTeam(team);
		setFromTeamId(myTeams[0]?.id ?? '');
		setStatus(null);
	}

	function selectEdit(team: TeamCardData) {
		setMenu(null);
		setEditingTeam(team);
	}

	function showPeek(member: RosterSlotPlayer, anchor: DOMRect) {
		if (peekTimer.current) window.clearTimeout(peekTimer.current);
		const width = 208;
		const left = Math.min(window.innerWidth - width - 12, Math.max(12, anchor.left + anchor.width / 2 - width / 2));
		setPeek({ member, left, top: anchor.top });
	}

	function hidePeek() {
		if (peekTimer.current) window.clearTimeout(peekTimer.current);
		peekTimer.current = window.setTimeout(() => setPeek(null), 220);
	}

	function bondOf(userId: string): 'self' | 'friends' | 'outgoing' | 'incoming' | 'none' {
		if (userId === currentUserId) return 'self';
		if (friendState.friends.includes(userId)) return 'friends';
		if (friendState.outgoing.includes(userId)) return 'outgoing';
		if (friendState.incoming.includes(userId)) return 'incoming';
		return 'none';
	}

	async function askFriend(userId: string) {
		const res = await fetch('/api/friends', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId })
		});
		const data = await res.json().catch(() => null);
		if (!res.ok || !data?.status) return;
		setFriendState((current) => {
			const friends = current.friends.filter((id) => id !== userId);
			const outgoing = current.outgoing.filter((id) => id !== userId);
			const incoming = current.incoming.filter((id) => id !== userId);
			if (data.status === 'friends') friends.push(userId);
			if (data.status === 'outgoing') outgoing.push(userId);
			return { friends, outgoing, incoming };
		});
	}

	async function uploadCover(teamId: string, slot: 'logo' | 'cover', file: File) {
		const limit = file.type.startsWith('video/') ? 8 * 1024 * 1024 : 4 * 1024 * 1024;
		if (file.size > limit) return 'Файл больше лимита: картинка 4 МБ, видео 8 МБ';
		const body = new FormData();
		body.set('slot', slot);
		body.set('file', file);
		const res = await fetch(`/api/teams/${teamId}/cover`, { method: 'POST', body });
		const data = await res.json().catch(() => null);
		if (!res.ok || !data?.team) return data?.error ?? 'Не удалось загрузить файл';
		setCards((current) => current.map((team) => (team.id === teamId ? { ...team, logo: data.team.logo, bannerUrl: data.team.bannerUrl, videoUrl: data.team.videoUrl } : team)));
		return null;
	}

	const chipClass = (active: boolean) =>
		`flex h-full w-full items-center justify-center rounded-full border px-2 py-2 text-center text-sm leading-tight transition lg:w-auto lg:px-4 ${active ? 'border-aegis bg-aegis/10 text-aegisSoft' : 'border-line text-muted hover:text-cream'}`;

	return (
		<div className="space-y-8" onClick={() => setMenu(null)}>
			{challengeDetailsLoading && (
				<div className="fixed inset-x-0 bottom-0 top-16 z-30 flex items-center justify-center bg-black/60 px-4">
					<div className="obsidian-glass rounded-card p-6 text-sm text-muted">Открываем вызов...</div>
				</div>
			)}

			<div className="space-y-4">
				{currentUserId ? (
					<button type="button" onClick={() => setCreateOpen(true)} className="create-team-cta flex w-full items-center justify-center rounded-full bg-aegis px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 lg:w-fit">
						Создай свою команду
					</button>
				) : (
					<a href="/api/auth/steam" className="create-team-cta flex w-full items-center justify-center rounded-full bg-aegis px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 lg:w-fit">
						Войти и создать
					</a>
				)}
				<h1 className="font-display text-3xl text-cream">Команды</h1>
				<div className={`grid gap-2 ${currentUserId ? 'grid-cols-3' : 'grid-cols-2'} lg:flex lg:flex-wrap lg:items-center`}>
					<button type="button" onClick={() => setTab('all')} className={chipClass(tab === 'all')}>
						Все команды ({cards.length})
					</button>
					<button type="button" onClick={() => setRecruitingOnly((current) => !current)} className={chipClass(recruitingOnly)}>
						Ищут состав ({recruitingCount})
					</button>
					{currentUserId && (
						<button type="button" onClick={() => setTab('mine')} className={chipClass(tab === 'mine')}>
							Мои команды ({myTeams.length})
						</button>
					)}
				</div>
			</div>

			{visibleTeams.length === 0 ? (
				<div className="obsidian-glass rounded-card p-8 text-muted">
					{recruitingOnly ? (
						'Сейчас никто не ищет игроков.'
					) : tab === 'mine' ? (
						<div className="flex flex-col items-start gap-4">
							<p>У вас пока нет созданных команд.</p>
							{currentUserId ? (
								<button type="button" onClick={() => setCreateOpen(true)} className="create-team-cta inline-flex items-center rounded-full bg-aegis px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110">
									Создай свою команду
								</button>
							) : null}
						</div>
					) : (
						'Команд пока нет.'
					)}
				</div>
			) : (
				<div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
					{visibleTeams.map((team) => (
						<div key={team.id} onContextMenu={(event) => openMenu(event, team)} className="h-[22.5rem] min-w-0">
							<TeamBoard
								team={team}
								isMine={team.createdById === currentUserId}
								signedIn={Boolean(currentUserId)}
								onPeek={showPeek}
								onHide={hidePeek}
								canChallenge={myTeams.length > 0}
								onEdit={() => selectEdit(team)}
								onChallenge={() => selectChallenge(team)}
								onUpload={(slot, file) => uploadCover(team.id, slot, file)}
							/>
						</div>
					))}
				</div>
			)}

			{peek && (
				<div
					className="fixed z-50 w-52 rounded-xl border border-line bg-ink p-3 text-left shadow-2xl"
					style={{ left: peek.left, top: peek.top, transform: 'translateY(calc(-100% - 8px))' }}
					onMouseEnter={() => peekTimer.current && window.clearTimeout(peekTimer.current)}
					onMouseLeave={hidePeek}
				>
					<div className="truncate text-sm text-cream">{peek.member.displayName}</div>
					<div className="mt-1 break-all font-mono text-[10px] text-muted">{peek.member.steamId || 'нет Steam'}</div>
					<div className="mt-1 text-[11px] text-aegisSoft">
						{peek.member.medal ? medalCaption(peek.member.medal) : 'без медали'}
						{peek.member.mmr ? ` · ${peek.member.mmr.value}` : ''}
					</div>
					{steamProfileHref(peek.member.steamId) && (
						<a href={steamProfileHref(peek.member.steamId)!} target="_blank" rel="noreferrer" className="mt-2 block text-[11px] text-cream hover:text-aegisSoft">
							Профиль Steam
						</a>
					)}
					{currentUserId && bondOf(peek.member.id) !== 'self' && (
						<button
							type="button"
							disabled={bondOf(peek.member.id) === 'friends' || bondOf(peek.member.id) === 'outgoing'}
							onClick={() => void askFriend(peek.member.id)}
							className="mt-2 w-full rounded-full border border-aegis/50 px-2 py-1 text-[11px] text-aegisSoft disabled:opacity-60"
						>
							{friendLabel(bondOf(peek.member.id))}
						</button>
					)}
				</div>
			)}

			{menu && (
				<div className="fixed z-50 w-72 rounded-xl border border-line bg-ink p-2 shadow-2xl" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}>
					<div className="px-3 py-2 text-xs uppercase tracking-wide text-muted">{menu.team.name}</div>
					{menu.team.createdById === currentUserId ? (
						<button type="button" onClick={() => selectEdit(menu.team)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-cream hover:bg-panel2">Редактировать профиль команды</button>
					) : (
						<button type="button" onClick={() => selectChallenge(menu.team)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-cream hover:bg-panel2">Вызвать на игру</button>
					)}
					{menu.team.contactUrl ? (
						<a href={menu.team.contactUrl} target="_blank" rel="noreferrer" className="block rounded-lg px-3 py-2 text-sm text-cream hover:bg-panel2">
							Контакт: {getContactMeta(menu.team.contactUrl).label}
						</a>
					) : (
						<span className="block rounded-lg px-3 py-2 text-sm text-muted/50">Контакт не указан</span>
					)}
					<button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-panel2" onClick={() => setMenu(null)}>Закрыть</button>
				</div>
			)}

			{editingTeam && (
				<div className="fixed inset-x-0 bottom-0 top-16 z-30 overflow-y-auto bg-black/60 px-4 py-8">
					<div className="mx-auto max-w-4xl">
						<div className="mb-3 flex justify-end">
							<button type="button" onClick={() => setEditingTeam(null)} className="rounded-lg border border-line bg-ink px-3 py-1.5 text-sm text-muted hover:text-cream">Закрыть</button>
						</div>
						<TeamCreateForm team={editingTeam} onSaved={() => setEditingTeam(null)} />
					</div>
				</div>
			)}

			{createOpen && (
				<div className="fixed inset-x-0 bottom-0 top-16 z-30 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm animate-[modalFade_180ms_ease-out]" onClick={() => setCreateOpen(false)}>
					<div className="w-full max-w-5xl animate-[modalRise_260ms_ease-out]" onClick={(event) => event.stopPropagation()}>
						<div className="mb-3 flex justify-end">
							<button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg border border-line bg-ink px-3 py-1.5 text-sm text-muted hover:text-cream">Закрыть</button>
						</div>

						{showCreateForm ? (
							<TeamCreateForm onSaved={() => setCreateOpen(false)} />
						) : (
							<div className="obsidian-glass rounded-card p-8 md:p-10 text-center">
								<div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl border border-aegis/50 bg-[#230a0a] shadow-[0_0_60px_rgba(216,168,78,0.22)]">
									<Image
										src="/dota2-logo-symbol.png"
										alt="Dota 2"
										width={64}
										height={64}
										unoptimized
										className="h-16 w-16 object-contain drop-shadow-[0_0_18px_rgba(242,207,123,0.34)]"
									/>
								</div>
								<h2 className="mt-8 font-display text-2xl text-cream">Подготовка профиля команды</h2>
								<p className="mt-2 text-sm text-muted">Собираем поля, медиа и аналитику состава.</p>
								<div className="mx-auto mt-7 max-w-md">
									<div className="mb-2 flex items-center justify-between text-xs font-mono text-muted">
										<span>DOTA PROFILE INIT</span>
										<span>{createProgress}%</span>
									</div>
									<div className="h-3 overflow-hidden rounded-full border border-line bg-panel">
										<div className="h-full rounded-full bg-aegis transition-all duration-100" style={{ width: `${createProgress}%` }} />
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{challengeTeam && (
				<div className="fixed inset-x-0 bottom-0 top-16 z-30 flex items-center justify-center bg-black/60 px-4">
					<div className="w-full max-w-lg rounded-card border border-line bg-ink p-6 shadow-2xl">
						<div className="flex items-start justify-between gap-4">
							<div>
								<h2 className="font-display text-2xl text-cream">Вызов на игру</h2>
								<p className="mt-1 text-sm text-muted">Лидер команды {challengeTeam.name} получит уведомление.</p>
							</div>
							<button type="button" onClick={() => setChallengeTeam(null)} className="rounded-lg border border-line px-3 py-1 text-sm text-muted hover:text-cream">Закрыть</button>
						</div>

						<div className="mt-5 space-y-4">
							<label className="block space-y-2">
								<span className="text-sm text-cream">Ваша команда</span>
								<select value={fromTeamId} onChange={(event) => setFromTeamId(event.target.value)} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream outline-none focus:border-aegis">
									<option value="">Выберите команду</option>
									{myTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
								</select>
							</label>
							<label className="block space-y-2">
								<span className="text-sm text-cream">Сообщение</span>
								<textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} className="min-h-28 w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream outline-none focus:border-aegis" placeholder="Предложите формат, время, сервер, bo1/bo3 или условия тренировки." />
							</label>
							{status && <div className="rounded-lg border border-line bg-panel/70 px-4 py-3 text-sm text-muted">{status}</div>}
							<button type="button" disabled={!fromTeamId} onClick={sendChallenge} className="w-full rounded-full bg-aegis px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-aegisSoft disabled:cursor-not-allowed disabled:opacity-60">Отправить вызов</button>
						</div>
					</div>
				</div>
			)}

			{openedChallenge && (
				<div className="fixed inset-x-0 bottom-0 top-16 z-30 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm animate-[modalFade_180ms_ease-out]">
					<div className="w-full max-w-2xl rounded-card border border-line bg-ink p-6 shadow-2xl animate-[modalRise_260ms_ease-out]">
						<div className="flex items-start justify-between gap-4">
							<div>
								<div className="text-xs uppercase tracking-wide text-aegisSoft">Вызов на игру</div>
								<h2 className="mt-1 font-display text-2xl text-cream">
									{openedChallenge.fromTeam?.name ?? 'Команда'} vs {openedChallenge.toTeam?.name ?? 'Команда'}
								</h2>
							</div>
							<button type="button" onClick={closeChallengeDetails} className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-cream">Закрыть</button>
						</div>

						<div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
							<div className="rounded-lg border border-line bg-panel/70 p-4">
								<div className="text-xs text-muted">Вызывает</div>
								<div className="mt-1 font-semibold text-cream">{openedChallenge.fromTeam?.name ?? 'Неизвестно'}</div>
							</div>
							<div className="rounded-lg border border-line bg-panel/70 p-4">
								<div className="text-xs text-muted">Кого вызвали</div>
								<div className="mt-1 font-semibold text-cream">{openedChallenge.toTeam?.name ?? 'Неизвестно'}</div>
							</div>
							<div className="rounded-lg border border-line bg-panel/70 p-4">
								<div className="text-xs text-muted">Статус</div>
								<div className="mt-1 font-semibold text-aegisSoft">{challengeStatusLabels[openedChallenge.status] ?? openedChallenge.status}</div>
							</div>
						</div>

						<p className="mt-4 text-sm text-muted">
							{openedChallenge.status === 'ACCEPTED'
								? 'Пара арены. Приза нет. Оба капитана сдают один счёт — рейтинг +16/−12.'
								: 'Пока это приглашение. После принятия откроется скрим без приза.'}
						</p>

						{openedChallenge.status === 'ACCEPTED' && openedChallenge.match && !['COMPLETED', 'TECHNICAL'].includes(openedChallenge.match.status) && (
							openedChallenge.canReport ? (
								<MatchScoreForm
									matchId={openedChallenge.match.id}
									canReport
									canForce={false}
									teamAName={openedChallenge.fromTeam?.name}
									teamBName={openedChallenge.toTeam?.name}
								/>
							) : (
								<p className="mt-4 text-sm text-muted">Счёт сдаёт капитан или заместитель участвующей команды.</p>
							)
						)}
						{openedChallenge.match && ['COMPLETED', 'TECHNICAL'].includes(openedChallenge.match.status) && (
							<p className="mt-4 font-mono text-sm text-aegisSoft">
								Счёт {openedChallenge.match.scoreA}:{openedChallenge.match.scoreB}. Приза нет.
							</p>
						)}

						<div className="mt-4 rounded-lg border border-line bg-panel/70 p-4 text-sm text-muted">
							<div className="mb-1 text-xs uppercase tracking-wide text-aegisSoft">Сообщение</div>
							{openedChallenge.message || 'Соперник не оставил сообщение.'}
						</div>

						{openedChallenge.scheduledAt && (
							<div className="mt-4 rounded-lg border border-line bg-panel/70 p-4 text-sm text-muted">
								<div className="mb-1 text-xs uppercase tracking-wide text-aegisSoft">Предложенное время</div>
								{new Date(openedChallenge.scheduledAt).toLocaleString('ru-RU')}
							</div>
						)}

						{openedChallenge.toUserId === currentUserId && ['PENDING', 'COUNTERED'].includes(openedChallenge.status) && (
							<div className="mt-5 space-y-4">
								<label className="block space-y-2">
									<span className="text-sm text-cream">Ответ или новое условие</span>
									<textarea value={counterMessage} onChange={(event) => setCounterMessage(event.target.value)} maxLength={500} className="min-h-24 w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream outline-none focus:border-aegis" placeholder="Например: можем сыграть bo3 завтра после 20:00, сервер EU East." />
								</label>
								<label className="block space-y-2">
									<span className="text-sm text-cream">Другое время</span>
									<input type="datetime-local" value={counterTime} onChange={(event) => setCounterTime(event.target.value)} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream outline-none focus:border-aegis" />
								</label>
								<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
									<button type="button" onClick={() => answerChallenge('ACCEPTED')} className="rounded-full bg-radiant px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110">Принять</button>
									<button type="button" onClick={() => answerChallenge('COUNTERED')} className="rounded-full border border-aegis/50 bg-aegis/10 px-4 py-2.5 text-sm font-semibold text-aegisSoft transition hover:border-aegis">Другое время</button>
									<button type="button" onClick={() => answerChallenge('DECLINED')} className="rounded-full border border-red-400/50 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200 transition hover:border-red-300">Отклонить</button>
								</div>
							</div>
						)}

						{openedChallenge.fromUserId === currentUserId && openedChallenge.toUserId !== currentUserId && (
							<div className="mt-5 rounded-lg border border-line bg-panel/70 p-4 text-sm text-muted">
								Вы отправили этот вызов. Здесь будет виден ответ соперника.
							</div>
						)}

						{challengeActionStatus && <div className="mt-5 rounded-lg border border-line bg-panel/70 px-4 py-3 text-sm text-muted">{challengeActionStatus}</div>}
					</div>
				</div>
			)}
		</div>
	);
}
