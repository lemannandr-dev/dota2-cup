'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { SteamButton } from '@/components/dota/SteamButton';
import { DeskMenu, bindDeskMenuClose, clampMenu, type DeskMenuItem } from '@/components/desk/DeskMenu';
import { PlayerSearchTable } from '@/components/players/PlayerSearchTable';
import type { PartyLfgCard, PartyOpenCup, PartyPlayer } from '@/lib/party-search';
import { lfgCardFromRow, sortPartyLfg } from '@/lib/party-search';
import { LfgSeekCard } from '@/components/players/LfgSeekCard';
import { PartyPanel, type InviteTarget } from '@/components/players/PartyPanel';
import { PullToRefresh } from '@/components/ui/PullToRefresh';

export type { PartyLfgCard, PartyPlayer };

const ROLE_LABELS: Record<number, string> = {
	1: '1 · Керри',
	2: '2 · Мид',
	3: '3 · Оффлейн',
	4: '4 · Поддержка',
	5: '5 · Полная поддержка'
};

export type PartyTeam = { id: string; name: string; tag: string | null; withSteam?: number; needed?: number };

type Props = {
	players: PartyPlayer[];
	lfgPosts: PartyLfgCard[];
	myTeams: PartyTeam[];
	openCups?: PartyOpenCup[];
	currentUserId: string | null;
	myLfg: PartyLfgCard | null;
	initialTab?: 'lfg' | 'players';
	initialTeamId?: string | null;
	initialTournamentId?: string | null;
	initialQuery?: string | null;
	focusPlayerId?: string | null;
};

function formatRemaining(iso: string) {
	const ms = new Date(iso).getTime() - Date.now();
	if (ms <= 0) return 'истекает';
	const hours = Math.floor(ms / 3_600_000);
	const minutes = Math.floor((ms % 3_600_000) / 60_000);
	if (hours >= 1) return `${hours} ч ${minutes} мин`;
	return `${Math.max(1, minutes)} мин`;
}

async function pullLfgFeed(userId: string | null): Promise<PartyLfgCard[]> {
	const res = await fetch('/api/lfg', { cache: 'no-store' });
	const data = await res.json().catch(() => null);
	const rows = Array.isArray(data?.posts) ? data.posts : [];
	const now = Date.now();
	return sortPartyLfg<PartyLfgCard>(
		rows.map((row: Parameters<typeof lfgCardFromRow>[0]) => lfgCardFromRow(row, now)),
		userId
	);
}

export function PartySearchBoard({
	players,
	lfgPosts,
	myTeams: initialTeams,
	openCups = [],
	currentUserId,
	myLfg,
	initialTab = 'lfg',
	initialTeamId = null,
	initialTournamentId = null,
	initialQuery = null,
	focusPlayerId = null
}: Props) {
	const [myTeams, setMyTeams] = useState(initialTeams);
	const [inviteTarget, setInviteTarget] = useState<InviteTarget | null>(null);
	const [tab, setTab] = useState<'lfg' | 'players'>(initialTab);
	const [role, setRole] = useState<number | null>(null);
	const [onlineOnly, setOnlineOnly] = useState(false);
	const [query, setQuery] = useState('');
	const [selectedRoles, setSelectedRoles] = useState<number[]>(myLfg?.roles ?? [5]);
	const [note, setNote] = useState(myLfg?.note ?? '');
	const [hours, setHours] = useState(6);
	const [saving, setSaving] = useState(false);
	const [formStatus, setFormStatus] = useState<string | null>(null);
	const [inviteTeamId, setInviteTeamId] = useState(
		(initialTeamId && myTeams.some((team) => team.id === initialTeamId) ? initialTeamId : myTeams[0]?.id) ?? ''
	);
	const [formOpen, setFormOpen] = useState(false);
	const [cupId, setCupId] = useState(initialTournamentId ?? myLfg?.tournament?.id ?? '');
	const [cupFilter, setCupFilter] = useState<string | null>(initialTournamentId);
	const [menu, setMenu] = useState<{ x: number; y: number; post?: PartyLfgCard } | null>(null);
	const [posts, setPosts] = useState(lfgPosts);
	const [mine, setMine] = useState(myLfg);

	const onlineCount = players.filter((player) => player.isOnline).length;
	const lookingCount = posts.length;
	const focusTeam = myTeams.find((team) => team.id === inviteTeamId) ?? null;

	const visiblePosts = useMemo(() => {
		const value = query.trim().toLowerCase();
		return posts.filter((post) => {
			if (role !== null && !post.roles.includes(role)) return false;
			if (onlineOnly && !post.isOnline) return false;
			if (cupFilter && post.tournament?.id !== cupFilter) return false;
			if (value && ![post.user.displayName, post.note, post.tournament?.title].filter(Boolean).some((field) => field!.toLowerCase().includes(value))) {
				return false;
			}
			return true;
		});
	}, [cupFilter, onlineOnly, posts, query, role]);

	function toggleRole(next: number) {
		setSelectedRoles((current) => (current.includes(next) ? current.filter((item) => item !== next) : [...current, next]));
	}

	async function refreshFeed() {
		const next = await pullLfgFeed(currentUserId);
		setPosts(next);
		setMine(currentUserId ? next.find((post) => post.user.id === currentUserId) ?? null : null);
	}

	async function publishLfg() {
		if (!currentUserId) {
			setFormStatus('Войдите через Steam, чтобы заявка появилась в ленте.');
			return;
		}
		const roles = selectedRoles.length > 0 ? selectedRoles : [5];
		if (selectedRoles.length === 0) setSelectedRoles(roles);
		setFormOpen(true);
		setSaving(true);
		setFormStatus('Публикуем заявку...');
		try {
			const res = await fetch('/api/lfg', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({
					roles,
					note: note.trim() || undefined,
					hours,
					tournamentId: cupId || null
				})
			});
			const data = await res.json().catch(() => null);
			if (!res.ok) {
				setFormStatus(data?.error ?? 'Не удалось опубликовать заявку.');
				return;
			}
			await refreshFeed();
			setFormStatus('Заявка в ленте. Капитаны её видят, это ещё не заявка на сетку.');
			setTab('lfg');
		} catch {
			setFormStatus('Сеть не ответила. Нажмите ещё раз.');
		} finally {
			setSaving(false);
		}
	}

	function inviteFromLfg(post: PartyLfgCard) {
		setInviteTarget({ id: post.user.id, displayName: post.user.displayName, tournamentId: post.tournament?.id || initialTournamentId || undefined, position: post.roles[0] });
	}
	useEffect(() => {
		if (!menu) return;
		return bindDeskMenuClose(() => setMenu(null), '#party-desk-menu, [aria-label="Действия заявки"], [aria-label="Действия поиска"]');
	}, [menu]);

	function placeMenu(post: PartyLfgCard | undefined, x: number, y: number) {
		setMenu({ ...clampMenu(x, y, 260, 380), post });
	}

	async function closeLfg() {
		setSaving(true);
		setFormStatus('Снимаем заявку...');
		try {
			const res = await fetch('/api/lfg', { method: 'DELETE' });
			if (!res.ok) {
				setFormStatus('Не удалось закрыть заявку.');
				return;
			}
			setMine(null);
			setPosts((current) => current.filter((post) => post.user.id !== currentUserId));
			setFormStatus('Заявка снята.');
			setFormOpen(false);
		} catch {
			setFormStatus('Сеть не ответила. Нажмите ещё раз.');
		} finally {
			setSaving(false);
		}
	}

	const headerItems: DeskMenuItem[] = [
		{ id: 'lfg', label: `Ищут пати (${lookingCount})`, hint: tab === 'lfg' ? 'Сейчас открыто' : 'Лента заявок', onSelect: () => { setTab('lfg'); setMenu(null); } },
		{ id: 'players', label: `Пригласить (${players.length})`, hint: tab === 'players' ? 'Сейчас открыто' : 'Каталог Steam', onSelect: () => { setTab('players'); setMenu(null); } },
		...(currentUserId
			? [{ id: 'form', label: mine ? 'Моя заявка' : 'Опубликовать заявку', hint: mine ? `ещё ${formatRemaining(mine.expiresAt)}` : 'Позиции и окно по времени', onSelect: () => { setFormOpen(true); setMenu(null); } }]
			: [{ id: 'steam', label: 'Войти через Steam', hint: 'Чтобы опубликовать заявку', href: '/api/auth/steam' }]),
		{ id: 'teams-page', label: 'Каталог команд', hint: 'Составы и вызов на катку', href: '/teams' }
	];

	const selectedCup = openCups.find((cup) => cup.id === cupId) ?? null;
	const filterHint = [
		tab === 'players' ? 'приглашение в состав' : 'лента заявок',
		onlineOnly ? 'только на арене' : null,
		role ? ROLE_LABELS[role] : null,
		cupFilter ? openCups.find((cup) => cup.id === cupFilter)?.title ?? 'кубок' : null
	].filter(Boolean).join(' · ');

	return (
		<PullToRefresh onRefresh={() => refreshFeed()} label="Обновить поиск">
		<div
			className="space-y-5"
			data-party-desk="true"
			onContextMenu={(event) => {
				const node = event.target as HTMLElement | null;
				if (node?.closest('input,select,textarea,a,button,article')) return;
				event.preventDefault();
				placeMenu(undefined, event.clientX, event.clientY);
			}}
		>
			<PartyPanel currentUserId={currentUserId} teamId={inviteTeamId} target={inviteTarget} onTargetClose={() => setInviteTarget(null)} onJoined={() => { void refreshFeed().catch(() => undefined); }} onRemoved={(removedId) => {
				setMyTeams((current) => current.filter((team) => team.id !== removedId));
				setInviteTeamId('');
			}} onParty={(party) => {
				setMyTeams((current) => {
					const previous = current.find((team) => team.id === party.id);
					if (previous?.withSteam === party.withSteam && previous?.needed === party.needed && previous?.name === party.name) return current;
					return previous ? current.map((team) => team.id === party.id ? party : team) : [...current, party];
				});
				setInviteTeamId(party.id);
			}} />
			<section className="border-b border-line py-4">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="min-w-0">
						<h1 className="font-display text-2xl text-cream">Поиск пати</h1>
						<p className="mt-2 text-sm text-muted">
							{lookingCount} ищут пати · на арене {onlineCount} · Steam {players.length}
							{mine ? ` · ваша заявка ещё ${formatRemaining(mine.expiresAt)}` : ''}
						</p>
						<p className="mt-1 text-xs text-muted">{filterHint}. Заявка в ленте — не заявка команды на сетку. «На арене» — заход на сайт за 15 минут.</p>
						{focusTeam && (focusTeam.needed ?? 0) > 0 && (
							<p className="mt-3 text-sm text-cream">
								Добрать состав «{focusTeam.name}»: ещё {focusTeam.needed} со Steam
								{initialTournamentId ? '. Приглашение привязано к кубку.' : '.'}
							</p>
						)}
					</div>
					<div className="flex shrink-0 items-center gap-2">
						{!currentUserId && <SteamButton />}
						{currentUserId && (
							<button
								type="button"
								onClick={() => setFormOpen(true)}
								className="rounded-full bg-aegis px-4 py-2 text-sm font-semibold text-ink hover:bg-aegisSoft"
							>
								{mine ? 'Моя заявка' : 'Ищу пати'}
							</button>
						)}
						<button
							type="button"
							aria-label="Действия поиска"
							onClick={(event) => {
								const rect = event.currentTarget.getBoundingClientRect();
								placeMenu(undefined, rect.right - 240, rect.bottom + 6);
							}}
							className="rounded-lg border border-line px-2.5 py-1 text-sm text-muted hover:text-cream"
						>
							⋯
						</button>
					</div>
				</div>

				<div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Стол поиска">
					<button
						type="button"
						role="tab"
						aria-selected={tab === 'lfg'}
						onClick={() => setTab('lfg')}
						className={`inline-flex min-h-9 items-center rounded-full border px-3 text-xs ${
							tab === 'lfg' ? 'border-aegis bg-aegis/15 text-aegisSoft' : 'border-line text-muted hover:text-cream'
						}`}
					>
						Ищут пати · {lookingCount}
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={tab === 'players'}
						onClick={() => setTab('players')}
						className={`inline-flex min-h-9 items-center rounded-full border px-3 text-xs ${
							tab === 'players' ? 'border-aegis bg-aegis/15 text-aegisSoft' : 'border-line text-muted hover:text-cream'
						}`}
					>
						Пригласить · {players.length}
					</button>
				</div>
				<div className="mt-2 flex flex-wrap gap-2" aria-label="Фильтры поиска">
					<button
						type="button"
						aria-pressed={onlineOnly}
						onClick={() => setOnlineOnly((value) => !value)}
						className={`inline-flex min-h-9 items-center rounded-full border px-3 text-xs ${
							onlineOnly ? 'border-aegis bg-aegis/15 text-aegisSoft' : 'border-line text-muted hover:text-cream'
						}`}
					>
						На арене · {onlineCount}
					</button>
					{([1, 2, 3, 4, 5] as const).map((item) => (
						<button
							key={item}
							type="button"
							aria-pressed={role === item}
							onClick={() => setRole(role === item ? null : item)}
							className={`inline-flex min-h-9 items-center rounded-full border px-3 text-xs ${
								role === item ? 'border-aegis bg-aegis/15 text-aegisSoft' : 'border-line text-muted hover:text-cream'
							}`}
						>
							{item}
						</button>
					))}
					{openCups.map((cup) => (
						<button
							key={cup.id}
							type="button"
							aria-pressed={cupFilter === cup.id}
							onClick={() => setCupFilter(cupFilter === cup.id ? null : cup.id)}
							className={`inline-flex min-h-9 max-w-[11rem] items-center truncate rounded-full border px-3 text-xs ${
								cupFilter === cup.id ? 'border-aegis bg-aegis/15 text-aegisSoft' : 'border-line text-muted hover:text-cream'
							}`}
						>
							{cup.title}
						</button>
					))}
				</div>

				{myTeams.length > 0 && (
					<div className="mt-3 flex flex-wrap items-center gap-2">
						<span className="text-[10px] uppercase tracking-[0.14em] text-muted">Приглашаю в</span>
						{myTeams.map((team) => (
							<button
								key={team.id}
								type="button"
								onClick={() => setInviteTeamId(team.id)}
								className={`inline-flex min-h-9 items-center rounded-full border px-3 text-xs ${
									inviteTeamId === team.id ? 'border-aegis bg-aegis/15 text-aegisSoft' : 'border-line text-muted hover:text-cream'
								}`}
							>
								{team.name}
								{typeof team.needed === 'number' ? ` · Steam ${team.withSteam ?? 0} из 5` : ''}
							</button>
						))}
					</div>
				)}
			</section>

			{formOpen && currentUserId && (
				<div id="lfg-form" className="obsidian-glass rounded-card space-y-4 p-5">
					<div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
						<div>
							<h2 className="font-display text-xl text-cream">{mine ? 'Обновить заявку' : 'Ищу пати на кубок'}</h2>
							<p className="mt-1 text-sm text-muted">
								Выберите позиции и, если нужно, открытый турнир. Капитаны увидят заявку в ленте — это не заявка команды на сетку.
							</p>
						</div>
						<div className="flex gap-2">
							{mine && (
								<button type="button" disabled={saving} onClick={() => void closeLfg()} className="rounded-full border border-line px-4 py-2 text-sm text-muted hover:text-cream disabled:opacity-60">
									Снять заявку
								</button>
							)}
							<button type="button" onClick={() => setFormOpen(false)} className="rounded-full border border-line px-4 py-2 text-sm text-muted hover:text-cream">
								Скрыть
							</button>
						</div>
					</div>
					<div className="flex flex-wrap gap-2" role="group" aria-label="Позиции в заявке">
						{[1, 2, 3, 4, 5].map((item) => {
							const on = selectedRoles.includes(item);
							return (
								<button
									key={item}
									type="button"
									aria-pressed={on}
									onClick={() => toggleRole(item)}
									className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
										on
											? 'border-aegis bg-aegis text-ink'
											: 'border-line bg-transparent text-muted hover:border-cream/40 hover:text-cream'
									}`}
								>
									{ROLE_LABELS[item]}
								</button>
							);
						})}
					</div>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<label className="space-y-2">
							<span className="text-sm text-cream">Кубок</span>
							<select
								value={cupId}
								onChange={(event) => setCupId(event.target.value)}
								className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream outline-none focus:border-aegis"
							>
								<option value="">Без кубка — просто ищу пятёрку</option>
								{openCups.map((cup) => (
									<option key={cup.id} value={cup.id}>
										{cup.title}
										{cup.status === 'LIVE' ? ' · идёт' : cup.status === 'CHECK_IN' ? ' · отметка' : ' · набор'}
									</option>
								))}
							</select>
							{selectedCup && (
								<p className="text-xs text-muted">
									Карточка турнира:{' '}
									<a href={`/tournaments/${selectedCup.id}`} className="text-aegisSoft hover:text-aegis">
										открыть
									</a>
									. Фонд и сетка — там, не здесь.
								</p>
							)}
							{openCups.length === 0 && <p className="text-xs text-muted">Сейчас нет открытых кубков — можно искать пати без привязки.</p>}
						</label>
						<label className="space-y-2">
							<span className="text-sm text-cream">Длительность</span>
							<select value={hours} onChange={(event) => setHours(Number(event.target.value))} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream outline-none focus:border-aegis">
								<option value={2}>2 часа</option>
								<option value={6}>6 часов</option>
								<option value={12}>12 часов</option>
								<option value={24}>24 часа</option>
							</select>
						</label>
					</div>
					<label className="block space-y-2">
						<span className="text-sm text-cream">Комментарий</span>
						<input
							value={note}
							onChange={(event) => setNote(event.target.value)}
							maxLength={240}
							className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream outline-none focus:border-aegis"
							placeholder={selectedCup ? `Свободен к старту «${selectedCup.title}», голос, роль` : 'EU East, голос, праки после 20:00'}
						/>
					</label>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<p
							role="status"
							aria-live="polite"
							className={`text-sm ${formStatus && /не|войд|сеть|некоррект/i.test(formStatus) ? 'text-red-200' : 'text-cream'}`}
						>
							{formStatus ?? 'Позиция 5 уже отмечена. Нажмите «Искать пати» — заявка появится в ленте ниже.'}
						</p>
						<button
							type="button"
							disabled={saving}
							onClick={() => void publishLfg()}
							className="inline-flex min-h-11 items-center justify-center rounded-full bg-aegis px-5 text-sm font-semibold text-ink hover:bg-aegisSoft disabled:opacity-60"
						>
							{saving ? 'Публикуем...' : mine ? 'Обновить заявку' : 'Искать пати'}
						</button>
					</div>
				</div>
			)}

			{tab === 'lfg' ? (
				<div className="space-y-5">
					<input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Ник или комментарий"
						className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream outline-none focus:border-aegis sm:max-w-xs"
					/>

					{visiblePosts.length === 0 ? (
						<div className="obsidian-glass rounded-card space-y-3 p-8 text-muted">
							<p>
								{posts.length === 0
									? currentUserId
										? 'Пока никто не ищет пати. Откройте форму — укажите роли и кубок, если ищете пятёрку под турнир.'
										: 'Пока никто не ищет пати. Войдите через Steam, чтобы опубликовать заявку с ролями и кубком.'
									: 'По выбранным фильтрам заявок нет.'}
							</p>
							{currentUserId ? (
								<button
									type="button"
									onClick={() => setFormOpen(true)}
									className="inline-flex min-h-11 items-center rounded-full bg-aegis px-4 text-sm font-semibold text-ink hover:bg-aegisSoft"
								>
									Ищу пати
								</button>
							) : posts.length === 0 ? (
								<a
									href="/api/auth/steam"
									className="inline-flex min-h-11 items-center rounded-full bg-aegis px-4 text-sm font-semibold text-ink hover:bg-aegisSoft"
								>
									Войти через Steam
								</a>
							) : null}
						</div>
					) : (
						<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
							{visiblePosts.map((post) => {
								const isSelf = post.user.id === currentUserId;
								return (
									<LfgSeekCard
										key={post.id}
										post={post}
										isSelf={isSelf}
										canInvite={Boolean(currentUserId && !isSelf)}
										inviteTeamName={focusTeam?.name ?? null}
										onMenu={(x, y) => placeMenu(post, x, y)}
										onInvite={() => void inviteFromLfg(post)}
										onEdit={() => {
											setFormOpen(true);
											document.getElementById('lfg-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
										}}
										onClose={() => void closeLfg()}
									/>
								);
							})}
						</div>
					)}
				</div>
			) : (
				<PlayerSearchTable
					players={players}
					currentUserId={currentUserId}
					onInvite={setInviteTarget}
					initialTournamentId={cupId || null}
					onlineOnly={onlineOnly}
					initialQuery={initialQuery}
					focusPlayerId={focusPlayerId}
				/>
			)}

			{menu && (
				<DeskMenu
					menuId="party-desk-menu"
					title={menu.post ? menu.post.user.displayName : 'Поиск пати'}
					x={menu.x}
					y={menu.y}
					items={
						menu.post
							? menu.post.user.id === currentUserId
								? [{ id: 'mine', label: 'Открыть мою заявку', hint: 'Позиции и таймер', onSelect: () => { setFormOpen(true); setMenu(null); } }]
									: currentUserId
									? [{ id: 'invite', label: 'Пригласить в команду', hint: inviteTeamId ? 'Не турнир и не +16/−12' : 'Сначала выберите команду', onSelect: () => { void inviteFromLfg(menu.post!); setMenu(null); } }]
									: [{ id: 'need', label: currentUserId ? 'Сначала создайте команду' : 'Войти через Steam', hint: currentUserId ? 'Страница «Команды»' : 'Чтобы пригласить игрока', href: currentUserId ? '/teams' : '/api/auth/steam' }]
							: headerItems
					}
				/>
			)}
		</div>
		</PullToRefresh>
	);
}
