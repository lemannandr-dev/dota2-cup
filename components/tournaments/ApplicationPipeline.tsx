'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { applicationLane, applicationPlaceLabel, type ApplicationLane } from '@/lib/match-handshake';
import { applicationStatusHint, applicationStatusLabel } from '@/lib/tournament-copy';
import { StatusPill } from '@/components/dota/StatusPill';
import {
	APPLICATION_DESK_FILTERS,
	applicationDeskCounts,
	filterApplicationDesk,
	type ApplicationDeskFilter,
	type ApplicationDeskRow,
	type ApplicationRemindKind
} from '@/lib/application-desk';

const laneMeta: Record<ApplicationLane, { title: string; hint: string; tone: 'radiant' | 'info' | 'aegis' | 'muted' | 'wait' }> = {
	waiting: {
		title: 'Ожидают принятия',
		hint: 'Капитан подал заявку. Организатор ещё не одобрил состав.',
		tone: 'info'
	},
	accepted: {
		title: 'Приняты в турнир',
		hint: 'Заявка одобрена. Дальше капитан отмечает состав, затем ждёт день старта.',
		tone: 'aegis'
	},
	hold: {
		title: 'Ждут день турнира',
		hint: 'Состав уже в сетке или отметился. До старта — жёлтое ожидание. В день турнира игроки получат уведомление: «готов» или «не сыграю».',
		tone: 'wait'
	},
	ready: {
		title: 'Готовы к игре',
		hint: 'В день турнира капитан или игрок состава нажал «Я готов». Команда может выходить на матч.',
		tone: 'radiant'
	},
	placed: {
		title: 'Сыграли',
		hint: 'Турнир закрыт. 1 и 2 место — по финалу, остальные просто сыграли. Это не жёлтое ожидание.',
		tone: 'radiant'
	},
	out: {
		title: 'Вне турнира',
		hint: 'Отклонены, снялись, не отметились, отказались в день старта или не дошли до сетки.',
		tone: 'muted'
	}
};

const liveLanes: ApplicationLane[] = ['waiting', 'accepted', 'hold', 'ready', 'out'];
const finishedLanes: ApplicationLane[] = ['placed', 'out'];
const cancelledLanes: ApplicationLane[] = ['out'];

const REMINDS: Array<{ kind: ApplicationRemindKind; label: string; hint: string }> = [
	{ kind: 'check_in', label: 'Напомнить чек-ин', hint: 'Командам без отметки в окне CHECK_IN' },
	{ kind: 'ready', label: 'Напомнить готовность', hint: 'В день старта, кто ещё молчит' },
	{ kind: 'needs_action', label: 'Напомнить «поправьте»', hint: 'Командам с NEEDS_ACTION' },
	{ kind: 'start_soon', label: 'Напомнить о старте', hint: 'Принятым составам' }
];

export function ApplicationPipeline({
	applications,
	startAt,
	tournamentStatus,
	tournamentId,
	isStaff = false
}: {
	applications: ApplicationDeskRow[];
	startAt: string;
	tournamentStatus: string;
	tournamentId?: string;
	isStaff?: boolean;
}) {
	const router = useRouter();
	const [filter, setFilter] = useState<ApplicationDeskFilter>('all');
	const [query, setQuery] = useState('');
	const [busy, setBusy] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const opts = { startAt, tournamentStatus };
	const visible =
		tournamentStatus === 'FINISHED' ? finishedLanes : tournamentStatus === 'CANCELLED' ? cancelledLanes : liveLanes;
	const filtered = useMemo(
		() => filterApplicationDesk(applications, { filter, query, startAt, tournamentStatus }),
		[applications, filter, query, startAt, tournamentStatus]
	);
	const counts = useMemo(
		() => applicationDeskCounts(applications, { startAt, tournamentStatus }),
		[applications, startAt, tournamentStatus]
	);
	const groups = Object.fromEntries(
		visible.map((lane) => [lane, filtered.filter((app) => applicationLane(app.status, app.readyStatus, opts) === lane)])
	) as Record<ApplicationLane, ApplicationDeskRow[]>;

	const filterChips = APPLICATION_DESK_FILTERS.filter((chip) => {
		if (chip.id === 'all') return true;
		if (tournamentStatus === 'FINISHED') return chip.id === 'out' || chip.id === 'placed';
		if (tournamentStatus === 'CANCELLED') return chip.id === 'out';
		return chip.id !== 'placed';
	});

	async function remind(kind: ApplicationRemindKind) {
		if (!tournamentId) return;
		setBusy(kind);
		setError(null);
		setMessage(null);
		try {
			const response = await fetch(`/api/tournaments/${tournamentId}/applications/remind`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({ kind })
			});
			const data = await response.json().catch(() => null);
			if (!response.ok) {
				setError(data?.error || 'Не удалось отправить');
				return;
			}
			setMessage(`Отправлено: ${data.notified} чел. · команд ${data.teams}`);
			router.refresh();
		} catch {
			setError('Сеть оборвалась');
		} finally {
			setBusy(null);
		}
	}

	return (
		<section id="applications" className="obsidian-glass space-y-4 rounded-card p-5 scroll-mt-24" data-application-desk="true">
			<div>
				<h2 className="font-display text-xl text-cream">
					{tournamentStatus === 'FINISHED' ? 'Кто сыграл и кто выбыл' : 'Кто принят и кто ждёт'}
				</h2>
				<p className="mt-1 text-sm text-muted">
					{tournamentStatus === 'FINISHED'
						? 'Кубок закрыт. Места пишутся по финалу, не по готовности накануне.'
						: tournamentStatus === 'CANCELLED'
							? 'Турнир отменён. Составы больше не ждут старт.'
							: 'Фильтр и поиск по команде. Орган может слать массовые напоминания в колокольчик.'}
				</p>
			</div>

			{isStaff ? (
				<div className="mobile-scroll-row flex snap-x gap-2 overflow-x-auto pb-1 md:hidden" aria-label="Очередь кубка">
					{filterChips.map((chip) => (
						<span
							key={chip.id}
							className="min-h-10 shrink-0 snap-start rounded-lg border border-line bg-panel/60 px-3 py-2 text-xs text-cream"
						>
							{chip.label}
							<span className="ml-2 font-mono text-aegisSoft">{counts[chip.id] ?? 0}</span>
						</span>
					))}
				</div>
			) : null}

			<div className="flex flex-col gap-3">
				<input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Поиск команды"
					className="min-h-12 w-full rounded-lg border border-line bg-panel px-3 text-base text-cream placeholder:text-muted md:max-w-sm"
				/>
				<div className="flex flex-wrap gap-2">
					{filterChips.map((chip) => (
						<button
							key={chip.id}
							type="button"
							onClick={() => setFilter(chip.id)}
							className={`inline-flex min-h-11 items-center rounded-lg border px-3 text-sm ${
								filter === chip.id ? 'border-aegis bg-aegis/15 text-aegisSoft' : 'border-line text-muted'
							}`}
						>
							{chip.label}
							<span className="ml-2 font-mono text-xs">{counts[chip.id] ?? 0}</span>
						</button>
					))}
				</div>
			</div>

			{isStaff && tournamentId && tournamentStatus !== 'FINISHED' && tournamentStatus !== 'CANCELLED' && (
				<div className="space-y-2 rounded-lg border border-line/70 bg-black/20 p-3">
					<div className="text-xs uppercase tracking-wide text-aegisSoft">Массовые напоминания</div>
					<div className="grid gap-2 sm:grid-cols-2">
						{REMINDS.map((item) => (
							<button
								key={item.kind}
								type="button"
								disabled={Boolean(busy)}
								onClick={() => void remind(item.kind)}
								className="min-h-12 rounded-lg border border-line px-3 py-2 text-left disabled:opacity-50"
							>
								<div className="text-sm text-cream">{busy === item.kind ? 'Шлём…' : item.label}</div>
								<div className="text-[11px] text-muted">{item.hint}</div>
							</button>
						))}
					</div>
					{message && <p className="text-xs text-aegisSoft">{message}</p>}
					{error && <p className="text-xs text-red-200">{error}</p>}
				</div>
			)}

			<div className={`grid grid-cols-1 items-start gap-3 md:grid-cols-2 ${visible.length > 2 ? 'xl:grid-cols-3' : 'xl:grid-cols-2'}`}>
				{visible.map((lane) => (
					<div
						key={lane}
						className={`rounded-xl border p-3 ${lane === 'hold' ? 'border-[#F5D76E]/45 bg-[#F5D76E]/10' : 'border-line bg-panel/40'}`}
					>
						<div className="text-sm font-semibold text-cream">{laneMeta[lane].title}</div>
						<div className="mt-1 text-xs leading-5 text-muted">{laneMeta[lane].hint}</div>
						<div className="mt-3 space-y-2">
							{groups[lane].map((app) => (
								<div key={app.id} className={`rounded-lg border px-2 py-2 ${lane === 'hold' ? 'border-[#F5D76E]/40 bg-black/20' : 'border-line/70'}`}>
									<div className="flex items-center justify-between gap-2">
										<span className="truncate text-sm text-cream">{app.team.name}</span>
										<StatusPill tone={lane === 'placed' && app.place === 1 ? 'aegis' : laneMeta[lane].tone}>
											{lane === 'hold'
												? 'Ожидание'
												: lane === 'ready'
													? 'Готовы'
													: lane === 'placed'
														? applicationPlaceLabel(app.place)
														: applicationStatusLabel(app.status)}
										</StatusPill>
									</div>
									<div className="mt-1 text-[11px] leading-4 text-muted">
										{lane === 'hold'
											? 'Ждём день турнира и ответ на уведомление о готовности.'
											: lane === 'ready'
												? 'Готовность подтверждена. Можно играть назначенный матч.'
												: lane === 'placed'
													? app.place
														? `${applicationPlaceLabel(app.place)} по финалу. Приз — капитану, если фонд был на эскроу.`
														: 'Сыграли сетку. Призового места нет.'
													: applicationStatusHint(app.status)}
									</div>
								</div>
							))}
							{groups[lane].length === 0 && <div className="text-xs text-muted">Пока никого</div>}
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
