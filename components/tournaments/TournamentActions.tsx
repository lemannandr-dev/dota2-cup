'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pickActionTeamId } from '@/lib/match-day';
import { partySearchHref } from '@/lib/team-roster';
import { summarizeCheckIn } from '@/lib/check-in-desk';
import { applicationStatusLabel } from '@/lib/tournament-copy';
import { fetchWithOfflineQueue } from '@/lib/offline-queue';
import { haptic } from '@/lib/haptics';
import { useToast } from '@/components/ui/ToastProvider';

export type CaptainTeam = { id: string; name: string; confirmedCount: number };

type Application = { id: string; teamId?: string; status: string; readyStatus?: string; team?: { id: string; name: string } };

type BroadcastDraft = {
	twitchChannel: string;
	twitchSecondary: string;
	youtubeUrl: string;
	dotaTv: string;
	lobbyName: string;
	delaySec: string;
	discordWebhook: string;
	telegramChatId: string;
	highlights: string;
};

type EscrowHint = {
	haveLabel: string;
	neededLabel: string;
	shortfall: number;
	shortfallLabel: string;
	prizeStatus: string;
};

type Props = {
	tournamentId: string;
	status: string;
	startAt: string;
	checkInClosesLabel?: string | null;
	isStaff: boolean;
	canCreateMore?: boolean;
	myTeams: CaptainTeam[];
	applications: Application[];
	broadcast?: BroadcastDraft;
	escrow?: EscrowHint | null;
};

const idemByAction: Record<string, string> = {};

async function post(url: string, body?: unknown, actionKey = url) {
	if (!idemByAction[actionKey]) {
		idemByAction[actionKey] =
			typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
				? crypto.randomUUID()
				: `ready-${Date.now()}`;
	}
	const result = await fetchWithOfflineQueue({
		url,
		method: 'POST',
		body,
		idempotencyKey: idemByAction[actionKey],
		label: actionKey.includes('/ready') ? 'Готовность' : actionKey.includes('/check-in') ? 'Чек-ин' : 'Действие кубка'
	});
	if (result.offline) {
		delete idemByAction[actionKey];
		throw new Error('offline_queued');
	}
	if (!result.ok) {
		const data = result.json as { error?: string } | null;
		throw new Error(data?.error || 'Ошибка запроса');
	}
	delete idemByAction[actionKey];
	return result.json as Record<string, unknown> | null;
}

export function TournamentActions({ tournamentId, status, startAt, checkInClosesLabel, isStaff, myTeams, applications, broadcast, escrow }: Props) {
	const router = useRouter();
	const { showToast } = useToast();
	const selectableTeams = useMemo(() => {
		const applied = new Set(applications.map((app) => app.teamId || app.team?.id).filter(Boolean));
		const registered = myTeams.filter((team) => applied.has(team.id));
		return status === 'REGISTRATION' || registered.length === 0 ? myTeams : registered;
	}, [applications, myTeams, status]);
	const [teamId, setTeamId] = useState(() => pickActionTeamId(selectableTeams, applications));
	const selectedTeam = selectableTeams.find((team) => team.id === teamId) ?? myTeams.find((team) => team.id === teamId);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [readyOverride, setReadyOverride] = useState<string | null>(null);
	const [cancelOpen, setCancelOpen] = useState(false);
	const [pairs, setPairs] = useState<Array<{ position: number; teamA: { name: string } | null; teamB: { name: string } | null; bye: boolean }>>([]);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [reviewNote, setReviewNote] = useState('');
	const checkInDesk = useMemo(() => summarizeCheckIn(applications), [applications]);
	const [desk, setDesk] = useState<BroadcastDraft>(() => ({
		twitchChannel: '',
		twitchSecondary: '',
		youtubeUrl: '',
		dotaTv: '',
		lobbyName: '',
		delaySec: '0',
		discordWebhook: '',
		telegramChatId: '',
		highlights: '',
		...broadcast
	}));

	const myApp = applications.find((app) => (app.teamId || app.team?.id) === teamId);
	const readyStatus = readyOverride ?? myApp?.readyStatus ?? 'PENDING';
	const tournamentDay = new Date().toISOString().slice(0, 10) >= startAt.slice(0, 10);
	const canAnswerReady = Boolean(
		myApp
		&& tournamentDay
		&& readyStatus === 'PENDING'
		&& ['APPROVED', 'CHECKED_IN', 'IN_BRACKET'].includes(myApp.status)
	);

	async function run(action: () => Promise<unknown>, after?: 'bracket' | 'ready' | 'declined') {
		if (after === 'ready' || after === 'declined') {
			if (!teamId) {
				setError('Выберите команду, которая заявлена в этот турнир');
				return;
			}
			if (!myApp) {
				setError('У выбранной команды нет заявки в этом турнире. Выберите команду из сетки.');
				return;
			}
		}
		setBusy(true);
		setError(null);
		try {
			await action();
			if (after === 'ready') {
				setReadyOverride('READY');
				haptic('success');
			}
			if (after === 'declined') setReadyOverride('DECLINED');
			if (after === 'bracket') {
				document.getElementById('bracket')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
			router.refresh();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Ошибка';
			if (message === 'offline_queued') {
				showToast('Отправим, когда сеть вернётся', 'info');
				setError(null);
			} else {
				setError(message);
			}
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="obsidian-glass rounded-card space-y-4 p-5">
			<div>
				<h3 className="font-display text-xl text-cream">Действия</h3>
				<p className="mt-1 text-sm text-muted">
					Заявить состав, отметиться, а в день турнира ответить на готовность. Пока старт не наступил, команда в сетке остаётся жёлтой «в ожидании».
				</p>
			</div>
			{selectableTeams.length > 0 && (
				<label className="block space-y-2 text-sm">
					<span className="text-muted">Ваша команда в этом турнире</span>
					<select value={teamId} onChange={(e) => { setTeamId(e.target.value); setReadyOverride(null); }} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-cream">
						{selectableTeams.map((team) => (
							<option key={team.id} value={team.id}>
								{team.name} — {team.confirmedCount} из 5 Steam
							</option>
						))}
					</select>
				</label>
			)}
			<div className="flex flex-wrap gap-2">
				{status === 'REGISTRATION' && (
					<button
						disabled={busy || !teamId || selectedTeam?.confirmedCount !== 5}
						onClick={() => run(() => post(`/api/tournaments/${tournamentId}/register`, { teamId }))}
						className="rounded-full bg-aegis px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
					>
						Заявить команду
					</button>
				)}
				{status === 'REGISTRATION' && selectedTeam && selectedTeam.confirmedCount !== 5 && (
					<p className="w-full text-xs text-muted">
						Нужны 5 подтверждённых со Steam. Сейчас {selectedTeam.confirmedCount} из 5.{' '}
						<a
							href={partySearchHref({ teamId: selectedTeam.id, tournamentId })}
							className="text-aegisSoft hover:text-aegis"
						>
							Пригласить в эту команду на этот кубок
						</a>
					</p>
				)}
				{(status === 'CHECK_IN' || status === 'REGISTRATION') && myApp && (
					<button disabled={busy || !teamId} onClick={() => run(() => post(`/api/tournaments/${tournamentId}/check-in`, { teamId }))} className="rounded-full border border-aegis/50 px-4 py-2 text-sm text-aegisSoft disabled:opacity-50">
						Отметить состав
					</button>
				)}
				{canAnswerReady && (
					<>
						<button type="button" disabled={busy || !teamId} onClick={() => void run(() => post(`/api/tournaments/${tournamentId}/ready`, { teamId, ready: true }), 'ready')} className="rounded-full bg-aegis px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50">
							{busy ? 'Сохраняем…' : 'Я готов'}
						</button>
						<button type="button" disabled={busy || !teamId} onClick={() => void run(() => post(`/api/tournaments/${tournamentId}/ready`, { teamId, ready: false }), 'declined')} className="rounded-full border border-red-400/40 px-4 py-2 text-sm text-red-200 disabled:opacity-50">
							Не смогу сыграть
						</button>
					</>
				)}
				{readyStatus === 'READY' && (
					<div className="rounded-lg border border-radiant/40 bg-radiant/10 px-3 py-2 text-sm text-cream">Готовность вашей команды подтверждена.</div>
				)}
				{readyStatus === 'DECLINED' && (
					<div className="rounded-lg border border-red-400/40 bg-red-950/20 px-3 py-2 text-sm text-red-200">Команда снята: не сыграете этот турнир.</div>
				)}
				{!tournamentDay && myApp && ['CHECKED_IN', 'IN_BRACKET', 'APPROVED'].includes(myApp.status) && (
					<div className="rounded-lg border border-[#F5D76E]/40 bg-[#F5D76E]/10 px-3 py-2 text-sm text-[#F5D76E]">
						До дня старта команда в ожидании. Уведомление «готов / не готов» придёт утром в день турнира.
					</div>
				)}
				{myApp && ['SUBMITTED', 'APPROVED', 'NEEDS_ACTION'].includes(myApp.status) && (
					<button disabled={busy || !teamId} onClick={() => run(() => post(`/api/tournaments/${tournamentId}/withdraw`, { teamId }))} className="rounded-full border border-line px-4 py-2 text-sm text-muted">
						Снять заявку
					</button>
				)}
				{isStaff && escrow && escrow.prizeStatus !== 'NONE' && (
					<p className="w-full text-xs text-muted">
						Кошелёк орга: {escrow.haveLabel} · фонд {escrow.neededLabel}
						{escrow.shortfall > 0 ? ` · не хватает ${escrow.shortfallLabel}` : escrow.prizeStatus === 'CONFIRMED' ? ' · на эскроу' : ' · можно резервировать на блоке приза'}
					</p>
				)}
				{isStaff && escrow && escrow.shortfall > 0 && (
					<button
						type="button"
						disabled={busy}
						onClick={() =>
							void run(() => post(`/api/tournaments/${tournamentId}/topup-request`))
						}
						className="rounded-full border border-aegis/40 px-4 py-2 text-sm text-aegisSoft"
					>
						Попросить пополнение
					</button>
				)}
				{isStaff && status === 'LIVE' && (
					<button
						disabled={busy}
						onClick={() => run(() => post(`/api/tournaments/${tournamentId}/status`, { status: 'FINISHED' }))}
						className="rounded-full bg-aegis px-4 py-2 text-sm font-semibold text-ink"
					>
						Завершить кубок
					</button>
				)}
				{isStaff && (
					<button
						disabled={busy}
						onClick={() =>
							void run(async () => {
								const data = (await post(`/api/tournaments/${tournamentId}/clone`)) as {
									tournament?: { id?: string };
								} | null;
								if (data?.tournament?.id) router.push(`/tournaments/${data.tournament.id}`);
							})
						}
						className="rounded-full border border-line px-4 py-2 text-sm text-muted"
					>
						Копия в черновик
					</button>
				)}
				{isStaff && status === 'DRAFT' && (
					<button disabled={busy} onClick={() => run(() => post(`/api/tournaments/${tournamentId}/publish`))} className="rounded-full bg-aegis px-4 py-2 text-sm font-semibold text-ink">
						Опубликовать
					</button>
				)}
				{isStaff && status === 'REGISTRATION' && (
					<button disabled={busy} onClick={() => run(() => post(`/api/tournaments/${tournamentId}/status`, { status: 'CHECK_IN' }))} className="rounded-full border border-aegis/50 px-4 py-2 text-sm text-aegisSoft">
						Открыть отметку состава
					</button>
				)}
				{isStaff && (status === 'CHECK_IN' || checkInDesk.dropped > 0) && (
					<div className="w-full space-y-2 rounded-lg border border-line px-3 py-2 text-sm">
						<div className="text-xs uppercase tracking-wide text-muted">Стол отметки</div>
						<p className="text-cream">
							Отметились {checkInDesk.present} · молчат {checkInDesk.silent}
							{checkInDesk.dropped ? ` · выбыли ${checkInDesk.dropped}` : ''}
							{checkInClosesLabel ? ` · окно до ${checkInClosesLabel} (МСК)` : ''}
						</p>
						{checkInDesk.silentTeams.map((team) => (
							<p key={team.id} className="text-xs text-muted">
								{team.name} — {applicationStatusLabel(team.status)}
							</p>
						))}
					</div>
				)}
				{isStaff && status === 'CHECK_IN' && (
					<>
						<button
							type="button"
							disabled={busy}
							onClick={() =>
								void run(async () => {
									const response = await fetch(`/api/tournaments/${tournamentId}/bracket`, { cache: 'no-store' });
									const body = await response.json();
									if (!response.ok) throw new Error(body.error || 'Нет посева');
									setPairs(body.pairs || []);
									setPreviewOpen(true);
								})
							}
							className="rounded-full border border-aegis/40 px-4 py-2 text-sm text-aegisSoft"
						>
							Показать посев
						</button>
						<button disabled={busy} onClick={() => run(() => post(`/api/tournaments/${tournamentId}/bracket`), 'bracket')} className="rounded-full bg-aegis px-4 py-2 text-sm font-semibold text-ink">
							Собрать сетку
						</button>
					</>
				)}
				{isStaff && status !== 'CANCELLED' && status !== 'FINISHED' && !cancelOpen && (
					<button type="button" disabled={busy} onClick={() => setCancelOpen(true)} className="rounded-full border border-red-400/40 px-4 py-2 text-sm text-red-200">
						Отменить
					</button>
				)}
			</div>
			{isStaff && cancelOpen && status !== 'CANCELLED' && status !== 'FINISHED' && (
				<div className="space-y-2 rounded-lg border border-red-400/40 bg-red-950/20 p-3">
					<p className="text-sm text-cream">
						Отмена снимет турнир. Сетку не продолжаем и призы не платим. Заявки останутся в истории.
					</p>
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							disabled={busy}
							onClick={() =>
								void run(async () => {
									await post(`/api/tournaments/${tournamentId}/status`, { status: 'CANCELLED', confirm: true });
									setCancelOpen(false);
								})
							}
							className="rounded-full bg-red-200 px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
						>
							Подтвердить отмену
						</button>
						<button type="button" disabled={busy} onClick={() => setCancelOpen(false)} className="text-sm text-muted">
							Назад
						</button>
					</div>
				</div>
			)}
			{isStaff && (
				<div className="space-y-2">
					<div className="text-xs uppercase tracking-wide text-muted">Стол эфира</div>
					<div className="grid grid-cols-1 gap-2 md:grid-cols-2">
						<input value={desk.twitchChannel} onChange={(e) => setDesk((d) => ({ ...d, twitchChannel: e.target.value }))} placeholder="Twitch стол" className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-cream" />
						<input value={desk.twitchSecondary} onChange={(e) => setDesk((d) => ({ ...d, twitchSecondary: e.target.value }))} placeholder="Twitch второй язык" className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-cream" />
						<input value={desk.youtubeUrl} onChange={(e) => setDesk((d) => ({ ...d, youtubeUrl: e.target.value }))} placeholder="YouTube https://…" className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-cream md:col-span-2" />
						<input value={desk.dotaTv} onChange={(e) => setDesk((d) => ({ ...d, dotaTv: e.target.value }))} placeholder="Dota TV" className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-cream" />
						<input value={desk.lobbyName} onChange={(e) => setDesk((d) => ({ ...d, lobbyName: e.target.value }))} placeholder="Имя лобби" className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-cream" />
						<input value={desk.delaySec} onChange={(e) => setDesk((d) => ({ ...d, delaySec: e.target.value }))} placeholder="Задержка, сек" className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-cream" />
						<input value={desk.discordWebhook} onChange={(e) => setDesk((d) => ({ ...d, discordWebhook: e.target.value }))} placeholder="Discord webhook кубка" className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-cream md:col-span-2" />
						<input value={desk.telegramChatId} onChange={(e) => setDesk((d) => ({ ...d, telegramChatId: e.target.value }))} placeholder="Telegram chat id кубка" className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-cream md:col-span-2" />
						<textarea
							value={desk.highlights}
							onChange={(e) => setDesk((d) => ({ ...d, highlights: e.target.value }))}
							placeholder="Хайлайты: по одной https-ссылке YouTube / Twitch / Kick / VK на строку"
							rows={3}
							className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-cream md:col-span-2"
						/>
					</div>
					<button
						disabled={busy}
						onClick={() =>
							run(() =>
								fetch(`/api/tournaments/${tournamentId}/broadcast`, {
									method: 'PUT',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({
										twitchChannel: desk.twitchChannel || undefined,
										twitchSecondary: desk.twitchSecondary || undefined,
										youtubeUrl: desk.youtubeUrl || undefined,
										dotaTv: desk.dotaTv || undefined,
										lobbyName: desk.lobbyName || undefined,
										delaySec: Number(desk.delaySec || 0),
										discordWebhook: desk.discordWebhook || undefined,
										telegramChatId: desk.telegramChatId || undefined,
										highlights: desk.highlights
									})
								}).then(async (res) => {
									const data = await res.json().catch(() => null);
									if (!res.ok) throw new Error(data?.error || 'Не удалось сохранить эфир');
									return data;
								})
							)
						}
						className="rounded-full border border-aegis/50 px-3 py-2 text-sm text-aegisSoft disabled:opacity-50"
					>
						Сохранить стол
					</button>
					<div className="text-xs uppercase tracking-wide text-muted">Модерация заявок</div>
					<input
						value={reviewNote}
						onChange={(event) => setReviewNote(event.target.value)}
						maxLength={280}
						placeholder="Причина для «поправьте состав» (увидит вся пятёрка)"
						className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-cream"
					/>
					{applications.filter((app) => app.status === 'WAITLIST').map((app) => (
						<div key={app.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
							<span className="text-cream">{app.team?.name ?? app.id} · лист ожидания</span>
							<button
								disabled={busy}
								onClick={() => run(() => post(`/api/tournaments/${tournamentId}/applications/${app.id}/promote`))}
								className="text-aegisSoft"
							>
								Поднять в слот
							</button>
						</div>
					))}
					{applications.filter((app) => app.status === 'SUBMITTED' || app.status === 'NEEDS_ACTION').map((app) => (
						<div key={app.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm">
							<span className="text-cream">{app.team?.name ?? app.id}</span>
							<div className="flex flex-wrap gap-2">
								<button disabled={busy} onClick={() => run(() => post(`/api/tournaments/${tournamentId}/applications/${app.id}/review`, { status: 'APPROVED' }))} className="text-aegisSoft">
									Одобрить
								</button>
								<button
									disabled={busy}
									onClick={() =>
										run(() =>
											post(`/api/tournaments/${tournamentId}/applications/${app.id}/review`, {
												status: 'NEEDS_ACTION',
												note: reviewNote || undefined
											})
										)
									}
									className="text-[#F5D76E]"
								>
									Поправьте состав
								</button>
								<button disabled={busy} onClick={() => run(() => post(`/api/tournaments/${tournamentId}/applications/${app.id}/review`, { status: 'REJECTED', note: reviewNote || undefined }))} className="text-red-200">
									Отклонить
								</button>
							</div>
						</div>
					))}
				</div>
			)}
			{previewOpen && (
				<div className="space-y-1 rounded-lg border border-line px-3 py-2 text-sm">
					<p className="text-cream">Первый круг (ещё не записан)</p>
					{pairs.map((pair) => (
						<p key={pair.position} className="text-muted">
							{pair.teamA?.name ?? 'BYE'} — {pair.teamB?.name ?? 'BYE'}
							{pair.bye ? ' · автопроход' : ''}
						</p>
					))}
				</div>
			)}
			{error && <div className="text-sm text-red-200">{error}</div>}
		</div>
	);
}
