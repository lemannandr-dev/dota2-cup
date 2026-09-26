import { adminTxTypeLabel } from '@/lib/admin-copy';

export const WALLET_FILTERS = ['ALL', 'IN', 'OUT', 'BONUS', 'ESCROW'] as const;
export type WalletFilter = (typeof WALLET_FILTERS)[number];

export type WalletTx = {
	id: string;
	type: string;
	amount: number;
	balance: number;
	description: string;
	createdAt: string;
};

export function parseWalletAmount(value: unknown) {
	if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isFinite(value)) return null;
	if (value === 0) return null;
	if (Math.abs(value) > 50_000_000) return null;
	return value;
}

export function walletFilterLabel(filter: WalletFilter) {
	if (filter === 'IN') return 'Приход';
	if (filter === 'OUT') return 'Расход';
	if (filter === 'BONUS') return 'Промо';
	if (filter === 'ESCROW') return 'Эскроу';
	return 'Все';
}

export function walletTxMatches(row: Pick<WalletTx, 'type' | 'amount'>, filter: WalletFilter) {
	if (filter === 'ALL') return true;
	if (filter === 'IN') return row.amount > 0;
	if (filter === 'OUT') return row.amount < 0;
	if (filter === 'BONUS') return row.type === 'BONUS';
	return row.type === 'SPENT' || row.type === 'REFUND';
}

export function walletTypeLabel(type: string) {
	return adminTxTypeLabel(type);
}

export function bonusCodeRejectReason(input: {
	isActive: boolean;
	amount: number;
	usedCount: number;
	maxUses: number | null;
	validFrom?: Date | string | null;
	validUntil?: Date | string | null;
	minLevel?: number | null;
	roles?: string[];
	userLevel?: number;
	userRole?: string;
	now?: Date;
}) {
	const now = input.now ?? new Date();
	if (!input.isActive || input.amount <= 0) return 'Код не подходит';
	if (input.validFrom && new Date(input.validFrom) > now) return 'Код ещё не начался';
	if (input.validUntil && new Date(input.validUntil) < now) return 'Срок действия истёк';
	if (input.maxUses != null && input.usedCount >= input.maxUses) return 'Лимит исчерпан';
	if (input.minLevel != null && (input.userLevel ?? 0) < input.minLevel) return 'Не хватает уровня';
	if (input.roles?.length && !input.roles.includes(input.userRole ?? '')) return 'Код не для этой роли';
	return null;
}

export function walletMatchesQuery(row: Pick<WalletTx, 'type' | 'description'>, query: string) {
	const needle = query.trim().toLowerCase();
	if (!needle) return true;
	return row.description.toLowerCase().includes(needle) || walletTypeLabel(row.type).toLowerCase().includes(needle);
}
