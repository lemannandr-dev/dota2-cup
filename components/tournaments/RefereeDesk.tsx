'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { refereeRatingLabel, type RefereeSeat } from '@/lib/referee-ballot';

type StaffRow = {
	userId: string;
	displayName: string;
	steamId: string | null;
	avatarUrl: string | null;
	role: string;
	isOwner: boolean;
	ratingLabel: string;
};

type Candidate = {
	userId: string;
	displayName: string;
	steamId: string | null;
	avatarUrl: string | null;
	rating: number;
	ratingGames: number;
	seat: RefereeSeat;
};

type KnownReferee = {
	userId: string;
	displayName: string;
	steamId: string | null;
	avatarUrl: string | null;
	ratingLabel: string;
	cups: number;
};

type Nomination = {
	id: string;
	userId: string;
	displayName: string;
	steamId: string | null;
	avatarUrl: string | null;
	ratingLabel: string;
	teamName: string;
	proposedBy: string;
	votes: number;
	mine: boolean;
};

type InboxRow = {
	matchId: string;
	href: string;
	teamA: string;
	teamB: string;
	score: string;
	reason: string;
	ageLabel?: string;
	stale?: boolean;
};

const roleLabel: Record<string, string> = {
	OWNER: 'Организатор',
	ADMIN: 'Админ турнира',
	REFEREE: 'Судья'
};

const seatCopy: Record<RefereeSeat, string | null> = {
	owner: 'уже организатор',
	referee: 'уже судья',
	open: null
};

export function RefereeDesk({
	tournamentId,
	canManage,
	staff,
	inbox,
	knownReferees,
	nominations,
	leaderId,
	canNominate,
	canVote
}: {
	tournamentId: string;
	canManage: boolean;
	staff: StaffRow[];
	inbox: InboxRow[];
	knownReferees: KnownReferee[];
	nominations: Nomination[];
	leaderId: string | null;
	canNominate: boolean;
	canVote: boolean;
}) {
	const router = useRouter();
	const [query, setQuery] = useState('');
	const [candidates, setCandidates] = useState<Candidate[]>([]);
	const [selected, setSelected] = useState<Candidate | null>(null);
	const [proposeQuery, setProposeQuery] = useState('');
	const [proposeChoices, setProposeChoices] = useState<Array<Pick<Candidate, 'userId' | 'displayName' | 'steamId' | 'rating' | 'ratingGames'>>>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!canManage) return;
		const value = query.trim();
		if (value.length < 2) {
			setCandidates([]);
			return;
		}
		const timer = window.setTimeout(async () => {
			try {
				const response = await fetch(`/api/tournaments/${tournamentId}/staff?q=${encodeURIComponent(value)}`, {
					cache: 'no-store'
				});
				const data = await response.json().catch(() => null);
				if (response.ok && Array.isArray(data?.candidates)) setCandidates(data.candidates);
			} catch {
				// поиск не обязан быть доступен при рестарте web
			}
		}, 250);
		return () => window.clearTimeout(timer);
	}, [canManage, query, tournamentId]);

	async function assign(userId?: string) {
		setBusy(true);
		setError(null);
		const response = await fetch(`/api/tournaments/${tournamentId}/staff`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(userId ? { userId } : { query })
		});
		const data = await response.json().catch(() => null);
		if (!response.ok) setError(data?.error || 'Не удалось назначить судью');
		else {
			setQuery('');
			setSelected(null);
			setCandidates([]);
			router.refresh();
		}
		setBusy(false);
	}

	async function propose(userId?: string) {
		setBusy(true);
		setError(null);
		const response = await fetch(`/api/tournaments/${tournamentId}/staff/nominations`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(userId ? { userId } : { query: proposeQuery })
		});
		const data = await response.json().catch(() => null);
		if (response.status === 409 && Array.isArray(data?.candidates)) {
			setProposeChoices(data.candidates);
			setError(data.error || 'Выберите человека из списка');
		} else if (!response.ok) {
			setProposeChoices([]);
			setError(data?.error || 'Не удалось предложить судью');
		} else {
			setProposeQuery('');
			setProposeChoices([]);
			router.refresh();
		}
		setBusy(false);
	}

	async function vote(nominationId: string) {
		setBusy(true);
		setError(null);
		const response = await fetch(`/api/tournaments/${tournamentId}/staff/votes`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ nominationId })
		});
		const data = await response.json().catch(() => null);
		if (!response.ok) setError(data?.error || 'Голос не записался');
		else router.refresh();
		setBusy(false);
	}

	async function remove(userId: string) {
		setBusy(true);
		setError(null);
		const response = await fetch(`/api/tournaments/${tournamentId}/staff`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId })
		});
		const data = await response.json().catch(() => null);
		if (!response.ok) setError(data?.error || 'Не удалось снять судью');
		else router.refresh();
		setBusy(false);
	}

	return (
		<section id="staff" className="obsidian-glass rounded-card p-5 space-y-4">
			<div>
				<h2 className="font-display text-xl text-cream">Судьи и споры</h2>
				<p className="mt-1 text-sm text-muted">
					Организатор назначает судью из тех, кто уже судил, или по нику на арене. Капитаны предлагают своего кандидата и голосуют: один голос на команду. Голос сам по себе судью не ставит.
				</p>
			</div>
			<ul className="space-y-2">
				{staff.map((row) => (
					<li key={row.userId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
						<div className="flex min-w-0 items-center gap-2">
							{row.avatarUrl ? (
								<Image src={row.avatarUrl} alt="" width={32} height={32} unoptimized className="h-8 w-8 rounded-full object-cover" />
							) : (
								<span className="flex h-8 w-8 items-center justify-center rounded-full bg-aegis/20 text-xs text-aegisSoft">
									{row.displayName.slice(0, 1).toUpperCase()}
								</span>
							)}
							<div className="min-w-0">
								<div className="truncate text-sm text-cream">{row.displayName}</div>
								<div className="text-[11px] text-muted">
									{roleLabel[row.role] ?? row.role}
									{row.steamId ? ` · ${row.steamId}` : ''}
									{` · ${row.ratingLabel}`}
								</div>
							</div>
						</div>
						{canManage && !row.isOwner && row.role === 'REFEREE' && (
							<button type="button" disabled={busy} onClick={() => void remove(row.userId)} className="text-xs text-red-200">
								Снять
							</button>
						)}
					</li>
				))}
				{staff.length === 0 && <li className="text-sm text-muted">В штабе пока никого. Судью назначает организатор.</li>}
			</ul>
			{canManage && knownReferees.length > 0 && (
				<div className="space-y-2">
					<p className="text-[10px] uppercase tracking-[0.16em] text-aegisSoft">Уже судили на арене</p>
					<ul className="space-y-1">
						{knownReferees.map((row) => (
							<li key={row.userId} className="flex items-center justify-between gap-2 rounded-lg border border-line/70 px-3 py-2">
								<div className="min-w-0">
									<div className="truncate text-sm text-cream">{row.displayName}</div>
									<div className="text-[11px] text-muted">{row.ratingLabel} · кубков {row.cups}</div>
								</div>
								<button
									type="button"
									disabled={busy}
									onClick={() => void assign(row.userId)}
									className="shrink-0 text-xs text-aegisSoft hover:text-aegis"
								>
									Назначить
								</button>
							</li>
						))}
					</ul>
				</div>
			)}
			{canManage && (
				<div className="space-y-2">
					<div className="flex flex-wrap gap-2">
						<input
							value={query}
							onChange={(event) => {
								setQuery(event.target.value);
								setSelected(null);
								setError(null);
							}}
							placeholder="Ник на арене или SteamID64"
							className="min-w-[220px] flex-1 rounded border border-line bg-panel px-2 py-1 text-sm text-cream"
						/>
						<button
							type="button"
							disabled={busy || (selected ? selected.seat !== 'open' : query.trim().length < 2)}
							onClick={() => void assign(selected?.seat === 'open' ? selected.userId : undefined)}
							className="rounded-full bg-aegis px-3 py-1 text-xs font-semibold text-ink disabled:opacity-50"
						>
							Назначить судью
						</button>
					</div>
					{candidates.length > 0 && (
						<ul className="space-y-1 rounded-lg border border-line bg-black/20 p-2">
							{candidates.map((row) => {
								const blocked = seatCopy[row.seat];
								return (
									<li key={row.userId}>
										<button
											type="button"
											disabled={Boolean(blocked)}
											onClick={() => {
												setSelected(row);
												setQuery(row.displayName);
												setError(blocked);
											}}
											className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm disabled:cursor-default ${
												selected?.userId === row.userId ? 'bg-aegis/20 text-cream' : 'text-cream hover:bg-white/5'
											}`}
										>
											<span className="min-w-0 truncate">{row.displayName}</span>
											<span className="shrink-0 text-[11px] text-muted">
												{blocked || refereeRatingLabel(row.rating, row.ratingGames)}
											</span>
										</button>
									</li>
								);
							})}
						</ul>
					)}
				</div>
			)}
			<div className="space-y-2">
				<p className="text-[10px] uppercase tracking-[0.16em] text-aegisSoft">Голосование капитанов</p>
				{canNominate && (
					<div className="flex flex-wrap gap-2">
						<input
							value={proposeQuery}
							onChange={(event) => {
								setProposeQuery(event.target.value);
								setProposeChoices([]);
								setError(null);
							}}
							placeholder="Ник кандидата на арене"
							className="min-w-[180px] flex-1 rounded border border-line bg-panel px-2 py-1 text-sm text-cream"
						/>
						<button
							type="button"
							disabled={busy || proposeQuery.trim().length < 2}
							onClick={() => void propose()}
							className="rounded-full border border-aegis/50 px-3 py-1 text-xs text-aegisSoft disabled:opacity-50"
						>
							Предложить
						</button>
					</div>
				)}
				{proposeChoices.length > 0 && (
					<ul className="space-y-1 rounded-lg border border-line bg-black/20 p-2">
						{proposeChoices.map((row) => (
							<li key={row.userId}>
								<button
									type="button"
									disabled={busy}
									onClick={() => void propose(row.userId)}
									className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm text-cream hover:bg-white/5"
								>
									<span className="truncate">{row.displayName}</span>
									<span className="text-[11px] text-muted">{refereeRatingLabel(row.rating, row.ratingGames)}</span>
								</button>
							</li>
						))}
					</ul>
				)}
				{nominations.length === 0 ? (
					<p className="text-sm text-muted">Капитаны ещё никого не предложили. Нужен ник человека, который уже заходил через Steam.</p>
				) : (
					<ul className="space-y-2">
						{nominations.map((row) => (
							<li key={row.id} className="rounded-lg border border-line px-3 py-2">
								<div className="flex items-start justify-between gap-2">
									<div className="min-w-0">
										<div className="truncate text-sm text-cream">
											{row.displayName}
											{row.id === leaderId ? ' · лидер' : ''}
										</div>
										<div className="text-[11px] text-muted">
											{row.ratingLabel} · {row.teamName} · {row.proposedBy} · голосов {row.votes}
										</div>
									</div>
									<div className="flex shrink-0 flex-col items-end gap-1">
										{canVote && (
											<button type="button" disabled={busy || row.mine} onClick={() => void vote(row.id)} className="text-xs text-aegisSoft disabled:text-muted">
												{row.mine ? 'ваш голос' : 'Голос команды'}
											</button>
										)}
										{canManage && (
											<button type="button" disabled={busy} onClick={() => void assign(row.userId)} className="text-xs text-cream">
												Назначить
											</button>
										)}
									</div>
								</div>
							</li>
						))}
					</ul>
				)}
			</div>
			{error && <p className="text-xs text-red-300">{error}</p>}
			<div id="disputes">
				<div className="text-sm font-semibold text-cream">Открытые споры</div>
				{inbox.length === 0 ? (
					<p className="mt-1 text-sm text-muted">Открытых споров нет.</p>
				) : (
					<ul className="mt-2 space-y-2">
						{inbox.map((row) => (
							<li key={row.matchId}>
								<a href={row.href} className={`block rounded-lg border px-3 py-2 text-sm text-cream hover:border-red-300/50 ${row.stale ? 'border-red-400/50 bg-red-950/20' : 'border-red-400/30 bg-red-950/20'}`}>
									{row.teamA} — {row.teamB} · {row.score} · {row.reason}
									{row.ageLabel ? ` · ${row.ageLabel}` : ''}
									{row.stale ? ' · висит больше часа' : ''}
								</a>
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}
