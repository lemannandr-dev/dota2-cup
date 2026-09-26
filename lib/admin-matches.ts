import { isOverdueReport } from '@/lib/admin-desk';

export const ADMIN_MATCH_STATUSES = ['PENDING', 'SCHEDULED', 'LIVE', 'NEEDS_REVIEW', 'COMPLETED', 'TECHNICAL'] as const;
export type AdminMatchStatus = (typeof ADMIN_MATCH_STATUSES)[number];

const RANK: Record<string, number> = {
	LIVE: 0,
	NEEDS_REVIEW: 1,
	SCHEDULED: 2,
	PENDING: 3,
	COMPLETED: 4,
	TECHNICAL: 5
};

export type AdminMatchGap = {
	id: string;
	label: string;
	hint: string;
	tone: 'alert' | 'soft';
};

export type AdminMatchInput = {
	status: string;
	scoreA: number;
	scoreB: number;
	bestOf: number;
	hasTeamA: boolean;
	hasTeamB: boolean;
	hasWinner: boolean;
	dotaMatchCount: number;
	reportDeadlineAt: string | null;
	openDisputeStatuses: string[];
};

export function isAdminMatchStatus(value: string | null): value is AdminMatchStatus {
	return ADMIN_MATCH_STATUSES.some((status) => status === value);
}

export function adminMatchRank(status: string) {
	return RANK[status] ?? 9;
}

export function adminMatchSeries(scoreA: number, scoreB: number, bestOf: number) {
	const played = Math.max(0, scoreA) + Math.max(0, scoreB);
	const cap = Math.max(1, bestOf);
	const needed = Math.ceil(cap / 2);
	return {
		played,
		cap,
		needed,
		decided: Math.max(scoreA, scoreB) >= needed && played > 0,
		ratio: Math.min(1, played / cap)
	};
}

export function adminMatchGaps(match: AdminMatchInput, now = new Date()): AdminMatchGap[] {
	const gaps: AdminMatchGap[] = [];
	const sides = Number(match.hasTeamA) + Number(match.hasTeamB);
	if (sides < 2 && match.status !== 'PENDING') {
		gaps.push({ id: 'opponent', label: 'Нет соперника', hint: 'В паре пустая сторона', tone: 'alert' });
	} else if (sides === 1 && match.status === 'PENDING') {
		gaps.push({ id: 'opponent', label: 'Нет соперника', hint: 'Вторая команда ещё не вышла из сетки', tone: 'soft' });
	}

	if (isOverdueReport({ reportDeadlineAt: match.reportDeadlineAt, status: match.status, now })) {
		gaps.push({ id: 'overdue', label: 'Просрочен репорт', hint: 'Дедлайн отчёта прошёл, счёт не закрыт', tone: 'alert' });
	} else if (['SCHEDULED', 'LIVE'].includes(match.status) && !match.reportDeadlineAt) {
		gaps.push({ id: 'deadline', label: 'Нет дедлайна', hint: 'Срок репорта не задан', tone: 'soft' });
	}

	if (match.openDisputeStatuses.length > 0) {
		gaps.push({
			id: 'dispute',
			label: match.openDisputeStatuses.includes('IN_REVIEW') ? 'На разборе' : 'Спор открыт',
			hint: 'Есть незакрытый спор по этой паре',
			tone: 'alert'
		});
	} else if (match.status === 'NEEDS_REVIEW') {
		gaps.push({ id: 'review', label: 'Счёт на судье', hint: 'Статус спора есть, отдельной заявки нет', tone: 'alert' });
	}

	if (['COMPLETED', 'TECHNICAL'].includes(match.status) && !match.hasWinner) {
		gaps.push({ id: 'winner', label: 'Нет победителя', hint: 'Пара закрыта без победителя', tone: 'alert' });
	}
	if (match.status === 'COMPLETED' && match.dotaMatchCount === 0) {
		gaps.push({ id: 'dota', label: 'Нет id Dota', hint: 'К закрытому счёту не привязан матч Dota', tone: 'soft' });
	}

	return gaps;
}
