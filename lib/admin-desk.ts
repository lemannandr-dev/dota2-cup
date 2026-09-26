import { describeEscrowWallet } from '@/lib/prize-places';

export type AdminAttentionKind =
	| 'escrow'
	| 'dispute'
	| 'review'
	| 'overdue_report'
	| 'no_checkin'
	| 'unpaid_prize'
	| 'stuck_escrow'
	| 'stuck_bracket';

export type AdminAttention = {
	id: string;
	kind: AdminAttentionKind;
	title: string;
	hint: string;
	href: string;
};

const STUCK_BRACKET_GRACE_MS = 2 * 60 * 1000;

export function isOverdueReport(input: {
	reportDeadlineAt: Date | string | null;
	status: string;
	now?: Date;
}) {
	if (!input.reportDeadlineAt) return false;
	if (['COMPLETED', 'TECHNICAL'].includes(input.status)) return false;
	const deadline = new Date(input.reportDeadlineAt);
	const now = input.now ?? new Date();
	return deadline.getTime() < now.getTime();
}

export function isStuckBracket(input: {
	status: string;
	checkInClosesAt: Date | string | null;
	matchCount: number;
	checkedInCount: number;
	now?: Date;
}) {
	if (input.status !== 'CHECK_IN') return false;
	if (input.matchCount > 0) return false;
	if (input.checkedInCount < 2) return false;
	if (!input.checkInClosesAt) return false;
	const closedAt = new Date(input.checkInClosesAt).getTime();
	const now = (input.now ?? new Date()).getTime();
	return now - closedAt >= STUCK_BRACKET_GRACE_MS;
}

export function buildAdminAttention(input: {
	cups: Array<{
		id: string;
		title: string;
		prizePool: number;
		prizeStatus: string;
		ownerBalance: number;
		ownerId?: string | null;
	}>;
	disputes: Array<{ id: string; matchId: string; tournamentId: string; tournamentTitle: string; pair: string }>;
	reviews: Array<{ id: string; tournamentId: string; tournamentTitle: string; pair: string }>;
	overdueReports?: Array<{ id: string; tournamentId: string; tournamentTitle: string; pair: string }>;
	noCheckInCups?: Array<{ id: string; title: string; pendingCount: number }>;
	unpaidPrizes?: Array<{ id: string; title: string; reservedCount: number }>;
	stuckEscrows?: Array<{ id: string; title: string; prizePool: number }>;
	stuckBrackets?: Array<{ id: string; title: string; checkedInCount: number }>;
}): AdminAttention[] {
	const rows: AdminAttention[] = [];
	for (const cup of input.cups) {
		if (cup.prizeStatus !== 'UNCONFIRMED' || cup.prizePool <= 0) continue;
		const wallet = describeEscrowWallet({ prizePool: cup.prizePool, balance: cup.ownerBalance });
		rows.push({
			id: `escrow-${cup.id}`,
			kind: 'escrow',
			title: `«${cup.title}»: фонд не на эскроу`,
			hint: wallet.shortfall > 0 ? `Не хватает ${wallet.shortfallLabel} на кошельке орга` : `Деньги есть — резерв на карточке кубка`,
			href: cup.ownerId ? `/admin/balance?userId=${cup.ownerId}` : `/tournaments/${cup.id}`
		});
	}
	for (const report of input.overdueReports ?? []) {
		rows.push({
			id: `overdue-${report.id}`,
			kind: 'overdue_report',
			title: `Просрочен репорт: ${report.pair}`,
			hint: report.tournamentTitle,
			href: `/tournaments/${report.tournamentId}#match-${report.id}`
		});
	}
	for (const dispute of input.disputes) {
		rows.push({
			id: `dispute-${dispute.id}`,
			kind: 'dispute',
			title: `Спор: ${dispute.pair}`,
			hint: dispute.tournamentTitle,
			href: `/tournaments/${dispute.tournamentId}#match-${dispute.matchId}`
		});
	}
	for (const cup of input.noCheckInCups ?? []) {
		rows.push({
			id: `no-checkin-${cup.id}`,
			kind: 'no_checkin',
			title: `«${cup.title}»: нет чек-ина`,
			hint: `${cup.pendingCount} команд не отметились после закрытия окна`,
			href: `/tournaments/${cup.id}`
		});
	}
	for (const cup of input.unpaidPrizes ?? []) {
		rows.push({
			id: `unpaid-${cup.id}`,
			kind: 'unpaid_prize',
			title: `«${cup.title}»: приз не выплачен`,
			hint: `${cup.reservedCount} строк RESERVED после FINISHED`,
			href: `/tournaments/${cup.id}#payouts`
		});
	}
	for (const cup of input.stuckEscrows ?? []) {
		rows.push({
			id: `stuck-escrow-${cup.id}`,
			kind: 'stuck_escrow',
			title: `«${cup.title}»: эскроу не вернулся`,
			hint: `CONFIRMED после отмены · ${Math.round(cup.prizePool / 100)} ₽`,
			href: `/tournaments/${cup.id}#payouts`
		});
	}
	for (const cup of input.stuckBrackets ?? []) {
		rows.push({
			id: `stuck-bracket-${cup.id}`,
			kind: 'stuck_bracket',
			title: `«${cup.title}»: сетка не собрана`,
			hint: `Чек-ин закрыт, ${cup.checkedInCount} команд ждут сетку`,
			href: `/tournaments/${cup.id}#bracket`
		});
	}
	for (const review of input.reviews) {
		rows.push({
			id: `review-${review.id}`,
			kind: 'review',
			title: `Ждёт судью: ${review.pair}`,
			hint: review.tournamentTitle,
			href: `/tournaments/${review.tournamentId}#match-${review.id}`
		});
	}
	return rows;
}
