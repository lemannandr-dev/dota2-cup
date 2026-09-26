'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Copy, Crown, Link2, LogOut, Share2, ShieldX, UserMinus, UserPlus, UsersRound, X } from 'lucide-react';
import { SteamAvatar } from '@/components/desk/SteamAvatar';
import { SteamButton } from '@/components/dota/SteamButton';

export type InviteTarget = { id: string; displayName: string; tournamentId?: string; position?: number };
type Party = {
	id: string; name: string; tag: string | null; leader: { id: string; displayName: string };
	members: { id: string; displayName: string; avatarUrl: string | null; isLeader: boolean; isSubstitute: boolean }[];
	roster: { confirmed: number; withSteam: number; full: boolean; ready: boolean; needed: number };
	locked: boolean; isMember: boolean; isLeader: boolean;
	cups: { id: string; title: string; status: string; applicationStatus: string }[];
};
type Invitation = { id: string; teamId: string; status: string; fromUser: { displayName: string } | null; toUserId: string | null; party: Party; canAccept: boolean };
type Props = {
	currentUserId: string | null; teamId: string; target: InviteTarget | null;
	onTargetClose: () => void; onParty: (party: { id: string; name: string; tag: string | null; withSteam: number; needed: number }) => void;
	onRemoved: (teamId: string) => void; onJoined: () => void;
	chrome?: boolean;
};

class PartyRequestError extends Error {
	constructor(message: string, readonly status: number) { super(message); }
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
	const res = await fetch(path, {
		method, cache: 'no-store', signal: AbortSignal.timeout(15000),
		...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
	});
	const data = await res.json().catch(() => null);
	if (!res.ok) throw new PartyRequestError(data?.error || 'Не удалось обновить пати.', res.status);
	return data;
}

export function PartyPanel({ currentUserId, teamId, target, onTargetClose, onParty, onRemoved, onJoined, chrome = true }: Props) {
	const router = useRouter();
	const dialog = useRef<HTMLDialogElement>(null);
	const shareInput = useRef<HTMLInputElement>(null);
	const [party, setParty] = useState<Party | null>(null);
	const [incoming, setIncoming] = useState<{ kind: 'invite' | 'join'; key: string } | null>(null);
	const [invitation, setInvitation] = useState<Invitation | null>(null);
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [message, setMessage] = useState('');
	const [sharedLink, setSharedLink] = useState<{ teamId: string; url: string } | null>(null);
	const shareUrl = sharedLink?.teamId === party?.id && party?.isMember ? sharedLink?.url ?? '' : '';
	const [confirmKick, setConfirmKick] = useState<string | null>(null);
	const [sentTarget, setSentTarget] = useState('');
	const [loginNext, setLoginNext] = useState('/party-search');
	const onPartyRef = useRef(onParty);
	const onRemovedRef = useRef(onRemoved);
	useEffect(() => {
		onPartyRef.current = onParty;
		onRemovedRef.current = onRemoved;
	}, [onParty, onRemoved]);
	const acceptParty = useCallback((next: Party) => {
		setParty(next);
		if (next.isMember) onPartyRef.current({ id: next.id, name: next.name, tag: next.tag, withSteam: next.roster.withSteam, needed: next.roster.needed });
	}, []);
	const endpoint = incoming ? incoming.kind === 'join' ? `/api/party/links/${encodeURIComponent(incoming.key)}` : `/api/teams/invitations/${encodeURIComponent(incoming.key)}` : null;

	useEffect(() => {
		setLoginNext(`${window.location.pathname}${window.location.search}`);
		const params = new URLSearchParams(window.location.search);
		const join = params.get('join');
		const invite = params.get('invite');
		if (join || invite) { setIncoming({ kind: join ? 'join' : 'invite', key: (join || invite)! }); setOpen(true); }
	}, []);

	useEffect(() => {
		if (target) { setOpen(true); setError(''); setMessage(''); setSentTarget(''); }
	}, [target]);

	useEffect(() => {
		const node = dialog.current;
		if (!node) return;
		if (open && !node.open) node.showModal();
		if (!open && node.open) node.close();
	}, [open]);

	useEffect(() => {
		if (!currentUserId || (!endpoint && !teamId)) { if (!endpoint) setParty(null); return; }
		if (!chrome && !open && !target && !endpoint) return;
		let active = true;
		let fetching = false;
		async function refresh() {
			if (fetching || document.visibilityState === 'hidden') return;
			fetching = true;
			try {
				if (endpoint) {
					const data = await request<{ invite: Invitation }>(endpoint);
					if (active) { setInvitation(data.invite); acceptParty(data.invite.party); }
				} else {
					const data = await request<{ party: Party }>(`/api/party/${encodeURIComponent(teamId)}`);
					if (active) acceptParty(data.party);
				}
			} catch (error) {
				if (active) {
					setError(error instanceof Error ? error.message : 'Нет соединения.');
					if (!endpoint && error instanceof PartyRequestError && [403, 404, 410].includes(error.status)) {
						setParty(null); setSharedLink(null); onRemovedRef.current(teamId);
					}
				}
			}
			finally { fetching = false; if (active) setLoading(false); }
		}
		setLoading(true); setError('');
		void refresh();
		const timer = window.setInterval(refresh, open ? 3000 : 10000);
		window.addEventListener('focus', refresh);
		document.addEventListener('visibilitychange', refresh);
		return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
	}, [currentUserId, teamId, endpoint, open, chrome, target, acceptParty]);

	function close() {
		if (busy) return;
		setOpen(false); onTargetClose(); setIncoming(null); setInvitation(null); setConfirmKick(null); setError(''); setMessage('');
		const url = new URL(window.location.href);
		url.searchParams.delete('invite'); url.searchParams.delete('join');
		if (party?.isMember) url.searchParams.set('teamId', party.id);
		window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
	}

	async function run(action: () => Promise<void>) {
		if (busy) return;
		setBusy(true); setError(''); setMessage('');
		try { await action(); }
		catch (error) { setError(error instanceof Error ? error.message : 'Сеть недоступна. Повторите попытку.'); }
		finally { setBusy(false); }
	}

	async function send() {
		if (!target) return;
		await run(async () => {
			const data = await request<{ party: Party }>('/api/teams/invitations', 'POST', { teamId: teamId || undefined, toUserId: target.id, tournamentId: target.tournamentId, position: target.position });
			acceptParty(data.party); setSentTarget(target.id); setMessage(`Приглашение для ${target.displayName} отправлено. Ожидаем ответ.`);
		});
	}

	async function answer(action: 'ACCEPTED' | 'DECLINED') {
		if (!endpoint) return;
		await run(async () => {
			const data = await request<{ invite: Invitation }>(endpoint, incoming?.kind === 'join' ? 'POST' : 'PATCH', incoming?.kind === 'join' ? undefined : { action });
			setInvitation(data.invite); acceptParty(data.invite.party);
			setMessage(action === 'ACCEPTED' ? 'Вы в пати.' : 'Приглашение отклонено.');
			if (action === 'ACCEPTED') onJoined();
		});
	}

	async function makeLink() {
		await run(async () => {
			const data = await request<{ path: string; party: Party }>('/api/party/links', 'POST', { teamId: party?.isMember ? party.id : teamId || undefined });
			acceptParty(data.party); setSharedLink({ teamId: data.party.id, url: new URL(data.path, window.location.origin).href });
			setMessage('Ссылка действует 24 часа.');
		});
	}

	async function copyLink() {
		try {
			if (!navigator.clipboard) throw new Error('Clipboard unavailable');
			await navigator.clipboard.writeText(shareUrl);
		} catch {
			// Local HTTP Android WebViews do not expose the secure Clipboard API.
			shareInput.current?.focus(); shareInput.current?.select();
			if (!document.execCommand('copy')) throw new Error('Ссылка выделена. Скопируйте её через меню телефона.');
		}
		setMessage('Ссылка скопирована.');
	}

	async function remove(userId: string) {
		if (!party) return;
		await run(async () => {
			await request(`/api/teams/${party.id}/members`, 'POST', { action: userId === currentUserId ? 'leave' : 'kick', userId });
			setConfirmKick(null); setSharedLink(null);
			if (userId === currentUserId) { router.push('/party-search'); return; }
			const data = await request<{ party: Party }>(`/api/party/${party.id}`);
			acceptParty(data.party); setMessage('Игрок исключён. Старые ссылки отозваны.');
		});
	}

	const showingParty = party && (incoming || party.id === teamId || !teamId);
	const canManage = showingParty && party.isMember;
	if (!chrome && !open) return null;
	return <section className={chrome ? 'party-panel' : undefined} aria-label="Моё пати">
		{chrome ? (
		<div className="flex min-w-0 items-center gap-3">
			<UsersRound className="h-6 w-6 shrink-0 text-cyan-300" aria-hidden="true" />
			<div className="min-w-0 flex-1"><p className="font-semibold text-cream">{party?.isMember ? party.name : 'Моё пати'}</p><p className="text-xs text-muted">{party?.isMember ? `${party.roster.confirmed}/5 · лидер ${party.leader.displayName}` : 'Соло · 1/5'}</p></div>
			<button type="button" className="party-command" onClick={() => setOpen(true)}><UsersRound size={17} />Состав</button>
		</div>
		) : null}
		<dialog ref={dialog} className="party-dialog" aria-labelledby="party-title" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
			<div className="party-dialog-inner">
				<header className="flex items-start justify-between gap-3 border-b border-line pb-4">
					<div className="min-w-0"><p className="text-xs text-cyan-300">DOTA 2 · ПАТИ</p><h2 id="party-title" className="mt-1 text-xl font-semibold text-cream">{target ? `Пригласить ${target.displayName}` : incoming && !party?.isMember ? 'Приглашение в пати' : party?.name || 'Моё пати'}</h2></div>
					<button type="button" aria-label="Закрыть пати" title="Закрыть" disabled={busy} className="party-icon" onClick={close}><X size={20} /></button>
				</header>
				{!currentUserId ? <div className="space-y-4 py-6"><p className="text-sm text-muted">Войдите, чтобы посмотреть состав и ответить на приглашение.</p><SteamButton next={loginNext} /></div> : <>
					{loading && !showingParty && <p role="status" className="py-5 text-muted">Проверяем состав...</p>}
					{showingParty ? <>
						<div className="flex items-center justify-between gap-3 py-4"><div className="min-w-0 text-sm text-muted"><p className="flex items-center gap-2 text-cream"><Crown size={16} className="shrink-0 text-aegis" />Лидер: {party.leader.displayName}</p>{incoming && <p className="mt-1">Пригласил: {invitation?.fromUser?.displayName || '...'}</p>}</div><strong className="shrink-0 font-mono text-2xl text-cyan-300" data-testid="party-count">{party.roster.confirmed}/5</strong></div>
						<ul className="divide-y divide-line" aria-label="Участники пати">{party.members.map((member) => <li key={member.id} className="flex min-h-16 items-center gap-3 py-2">
							<SteamAvatar url={member.avatarUrl} name={member.displayName} className="h-10 w-10 shrink-0" />
							<div className="min-w-0 flex-1"><p className="break-words text-sm text-cream">{member.displayName}{member.id === currentUserId ? ' · вы' : ''}</p><p className="text-xs text-muted">{member.isLeader ? 'Лидер' : member.isSubstitute ? 'Запасной' : 'Игрок'}</p></div>
							{party.isLeader && !member.isLeader && <button type="button" disabled={busy || party.locked} className="party-icon text-red-200" aria-label={`Исключить ${member.displayName}`} title="Исключить из пати" onClick={() => setConfirmKick(member.id)}><UserMinus size={18} /></button>}
						</li>)}</ul>
						{!party.roster.full && <p className="border-t border-dashed border-line py-3 text-sm text-muted">Свободно мест: {5 - party.roster.confirmed}</p>}
						{party.locked && <p className="my-3 border-l-2 border-aegis pl-3 text-sm text-aegisSoft">Состав зафиксирован для кубка. Замены доступны на странице турнира.</p>}
					</> : !incoming && !loading && <p className="py-5 text-sm text-muted">Вы играете соло. При первом приглашении создаётся ваше пати, вы становитесь лидером.</p>}
					{confirmKick && <div className="my-3 border-y border-red-400/40 py-3"><p className="text-sm text-cream">{confirmKick === currentUserId ? 'Выйти из пати?' : `Исключить ${party?.members.find((m) => m.id === confirmKick)?.displayName}?`}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} className="party-command border-red-400/50 text-red-200" onClick={() => void remove(confirmKick)}><UserMinus size={16} />Подтвердить</button><button type="button" disabled={busy} className="party-command" onClick={() => setConfirmKick(null)}>Отмена</button></div></div>}
					{target && <button type="button" disabled={busy || loading || Boolean(party?.locked || party?.roster.full) || sentTarget === target.id} className="party-command party-primary mt-3 w-full" onClick={() => void send()}>{sentTarget === target.id ? <Check size={18} /> : <UserPlus size={18} />}{sentTarget === target.id ? 'Приглашение отправлено' : 'Отправить приглашение'}</button>}
					{incoming && invitation && !party?.isMember && <div className="my-4 space-y-3">
						{invitation.status === 'PENDING' ? <><button type="button" className="party-command party-primary w-full" disabled={busy || !invitation.canAccept} onClick={() => void answer('ACCEPTED')}><Check size={18} />Принять приглашение</button>{!invitation.canAccept && <p className="text-sm text-muted">{party?.locked ? 'Состав зафиксирован.' : party?.roster.full ? 'Пати уже заполнено.' : 'Это приглашение недоступно для вашего аккаунта.'}</p>}{incoming.kind === 'invite' && invitation.toUserId === currentUserId && <button type="button" className="party-command w-full" disabled={busy} onClick={() => void answer('DECLINED')}><X size={18} />Отклонить</button>}</> : <p className="text-sm text-muted">{invitation.status === 'EXPIRED' ? 'Срок ссылки истёк, она отозвана или пригласивший вышел из пати.' : invitation.status === 'ACCEPTED' ? 'Приглашение уже принято.' : 'Приглашение отклонено.'}</p>}
					</div>}
					{(canManage || (!incoming && !teamId && !target)) && <div className="mt-4 space-y-3 border-t border-line pt-4">
						<button type="button" disabled={busy || loading || Boolean(party?.locked || party?.roster.full)} className="party-command w-full" onClick={() => void makeLink()}><Link2 size={18} />Пригласить по ссылке</button>
						{shareUrl && <div className="space-y-2"><label className="block text-xs text-muted" htmlFor="party-link">Ссылка приглашения</label><input ref={shareInput} id="party-link" className="w-full min-w-0 rounded-lg border border-line bg-panel px-3 py-3 text-base text-cream" value={shareUrl} readOnly onFocus={(event) => event.target.select()} /><div className="flex gap-2"><button type="button" className="party-command flex-1" onClick={() => void run(copyLink)}><Copy size={16} />Копировать</button><button type="button" className="party-icon" title="Поделиться" aria-label="Поделиться ссылкой" onClick={() => void run(async () => { if (navigator.share) await navigator.share({ title: 'Пати Aegis Arena', url: shareUrl }); else await copyLink(); })}><Share2 size={18} /></button></div></div>}
						{party?.isLeader && <button type="button" disabled={busy} className="party-command w-full text-muted" onClick={() => void run(async () => { await request('/api/party/links', 'DELETE', { teamId: party.id }); setSharedLink(null); setMessage('Все ссылки пати отозваны.'); })}><ShieldX size={17} />Отозвать ссылки</button>}
						{party && !party.isLeader && <button type="button" disabled={busy || party.locked} className="party-command w-full text-red-200" onClick={() => setConfirmKick(currentUserId)}><LogOut size={17} />Выйти из пати</button>}
						{party?.isLeader && party.roster.ready && !party.locked && <Link href="/tournaments?status=REGISTRATION" className="party-command party-primary w-full">Выбрать кубок</Link>}
						{party?.cups.map((cup) => <Link key={cup.id} className="party-command w-full" href={`/tournaments/${cup.id}?open=bracket#bracket`}>{cup.title}</Link>)}
					</div>}
				</>}
				{error && <p role="alert" className="mt-4 text-sm text-red-200">{error}</p>}
				{message && <p role="status" className="mt-4 text-sm text-cyan-200">{message}</p>}
				{busy && <p role="status" className="mt-3 text-sm text-muted">Сохраняем...</p>}
			</div>
		</dialog>
	</section>;
}
