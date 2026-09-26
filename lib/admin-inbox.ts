import type { AdminAttention, AdminAttentionKind } from '@/lib/admin-desk';

export type AdminInboxFilter = 'all' | 'matchday' | 'money' | 'roster';

const MATCHDAY: AdminAttentionKind[] = ['dispute', 'review', 'overdue_report'];
const MONEY: AdminAttentionKind[] = ['escrow', 'unpaid_prize', 'stuck_escrow'];
const ROSTER: AdminAttentionKind[] = ['no_checkin', 'stuck_bracket'];

export function adminInboxFilterFor(kind: AdminAttentionKind): Exclude<AdminInboxFilter, 'all'> {
	if (MATCHDAY.includes(kind)) return 'matchday';
	if (MONEY.includes(kind)) return 'money';
	return 'roster';
}

export function filterAdminInbox(rows: AdminAttention[], filter: AdminInboxFilter) {
	if (filter === 'all') return rows;
	const allowed =
		filter === 'matchday' ? MATCHDAY : filter === 'money' ? MONEY : ROSTER;
	return rows.filter((row) => allowed.includes(row.kind));
}

export function adminInboxCounts(rows: AdminAttention[]) {
	return {
		all: rows.length,
		matchday: rows.filter((row) => MATCHDAY.includes(row.kind)).length,
		money: rows.filter((row) => MONEY.includes(row.kind)).length,
		roster: rows.filter((row) => ROSTER.includes(row.kind)).length
	};
}

export function adminInboxKindLabel(kind: AdminAttentionKind) {
	switch (kind) {
		case 'dispute':
			return 'Спор';
		case 'review':
			return 'Судья';
		case 'overdue_report':
			return 'Просрочка';
		case 'escrow':
			return 'Эскроу';
		case 'unpaid_prize':
			return 'Выплата';
		case 'stuck_escrow':
			return 'Возврат';
		case 'no_checkin':
			return 'Чек-ин';
		case 'stuck_bracket':
			return 'Сетка';
		default:
			return kind;
	}
}
