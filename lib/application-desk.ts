import { applicationLane, type ApplicationLane } from '@/lib/match-handshake';

export type ApplicationDeskFilter = 'all' | ApplicationLane | 'needs_action' | 'waitlist';

export type ApplicationDeskRow = {
	id: string;
	status: string;
	readyStatus?: string;
	place?: number | null;
	team: { name: string };
	captainId?: string | null;
	memberIds?: string[];
};

export type ApplicationRemindKind = 'check_in' | 'ready' | 'needs_action' | 'start_soon';

export const APPLICATION_DESK_FILTERS: Array<{ id: ApplicationDeskFilter; label: string }> = [
	{ id: 'all', label: 'Все' },
	{ id: 'waiting', label: 'На разборе' },
	{ id: 'needs_action', label: 'Поправить' },
	{ id: 'waitlist', label: 'Лист' },
	{ id: 'accepted', label: 'Приняты' },
	{ id: 'hold', label: 'Ждут день' },
	{ id: 'ready', label: 'Готовы' },
	{ id: 'placed', label: 'Сыграли' },
	{ id: 'out', label: 'Вне' }
];

export function filterApplicationDesk(
	rows: ApplicationDeskRow[],
	input: {
		filter: ApplicationDeskFilter;
		query?: string;
		startAt: string;
		tournamentStatus: string;
	}
) {
	const q = input.query?.trim().toLowerCase() ?? '';
	const opts = { startAt: input.startAt, tournamentStatus: input.tournamentStatus };
	return rows.filter((row) => {
		if (q && !row.team.name.toLowerCase().includes(q)) return false;
		if (input.filter === 'all') return true;
		if (input.filter === 'needs_action') return row.status === 'NEEDS_ACTION';
		if (input.filter === 'waitlist') return row.status === 'WAITLIST';
		return applicationLane(row.status, row.readyStatus, opts) === input.filter;
	});
}

export function applicationDeskCounts(
	rows: ApplicationDeskRow[],
	input: { startAt: string; tournamentStatus: string }
) {
	const base = { startAt: input.startAt, tournamentStatus: input.tournamentStatus };
	const counts: Record<ApplicationDeskFilter, number> = {
		all: rows.length,
		waiting: 0,
		accepted: 0,
		hold: 0,
		ready: 0,
		placed: 0,
		out: 0,
		needs_action: 0,
		waitlist: 0
	};
	for (const row of rows) {
		if (row.status === 'NEEDS_ACTION') counts.needs_action += 1;
		if (row.status === 'WAITLIST') counts.waitlist += 1;
		const lane = applicationLane(row.status, row.readyStatus, base);
		counts[lane] += 1;
	}
	return counts;
}

export function recipientsForRemind(
	rows: ApplicationDeskRow[],
	kind: ApplicationRemindKind,
	input: { tournamentStatus: string; startAt?: string | null; now?: Date }
) {
	const now = input.now ?? new Date();
	const day = input.startAt ? now.toISOString().slice(0, 10) >= String(input.startAt).slice(0, 10) : false;
	return rows.filter((row) => {
		if (kind === 'needs_action') return row.status === 'NEEDS_ACTION';
		if (kind === 'check_in') {
			return input.tournamentStatus === 'CHECK_IN' && ['APPROVED', 'SUBMITTED', 'NEEDS_ACTION'].includes(row.status);
		}
		if (kind === 'ready') {
			return (
				day &&
				['CHECKED_IN', 'IN_BRACKET', 'APPROVED'].includes(row.status) &&
				(row.readyStatus ?? 'PENDING') === 'PENDING'
			);
		}
		if (kind === 'start_soon') {
			return ['APPROVED', 'CHECKED_IN', 'IN_BRACKET'].includes(row.status);
		}
		return false;
	});
}

export function applicationRemindNotifyRows(input: {
	kind: ApplicationRemindKind;
	tournamentId: string;
	title: string;
	userIds: string[];
}) {
	const unique = [...new Set(input.userIds.filter(Boolean))];
	const copy =
		input.kind === 'check_in'
			? {
					type: 'TOURNAMENT_REMIND_CHECK_IN',
					title: `Напоминание: отметка — ${input.title}`,
					body: 'Окно чек-ина открыто. Капитан отметьте пятёрку на карточке кубка, иначе команда вылетит.'
				}
			: input.kind === 'ready'
				? {
						type: 'TOURNAMENT_REMIND_READY',
						title: `Напоминание: готовность — ${input.title}`,
						body: 'Сегодня день турнира. Нажмите «Я готов» или снимите команду на карточке кубка.'
					}
				: input.kind === 'needs_action'
					? {
							type: 'TOURNAMENT_REMIND_NEEDS_ACTION',
							title: `Напоминание: состав — ${input.title}`,
							body: 'Организатор ждёт правки заявки. Откройте кубок и поправьте пятёрку.'
						}
					: {
							type: 'TOURNAMENT_REMIND_START',
							title: `Напоминание: старт близко — ${input.title}`,
							body: 'Кубок скоро. Проверьте состав, Steam и готовность капитана на карточке.'
						};
	return unique.map((userId) => ({
		userId,
		type: copy.type,
		title: copy.title,
		body: copy.body,
		linkUrl: `/tournaments/${input.tournamentId}`
	}));
}

export function collectRemindUserIds(rows: ApplicationDeskRow[]) {
	const ids: string[] = [];
	for (const row of rows) {
		if (row.captainId) ids.push(row.captainId);
		for (const memberId of row.memberIds ?? []) ids.push(memberId);
	}
	return [...new Set(ids.filter(Boolean))];
}
