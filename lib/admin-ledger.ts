export type LedgerTxFilter = {
	q?: string;
	type?: string;
	user?: string;
	from?: string;
	to?: string;
};

export function ledgerTxMatches(
	row: { description: string; type: string; userName?: string | null; createdAt: Date | string },
	filter: LedgerTxFilter
) {
	if (filter.type && row.type !== filter.type) return false;
	if (filter.user) {
		const needle = filter.user.trim().toLowerCase();
		if (!(row.userName || '').toLowerCase().includes(needle)) return false;
	}
	const at = typeof row.createdAt === 'string' ? Date.parse(row.createdAt) : row.createdAt.getTime();
	if (filter.from && at < Date.parse(filter.from)) return false;
	if (filter.to && at > Date.parse(filter.to) + 86_399_000) return false;
	if (filter.q) {
		const q = filter.q.trim().toLowerCase();
		const hay = `${row.description} ${row.userName ?? ''} ${row.type}`.toLowerCase();
		if (!hay.includes(q)) return false;
	}
	return true;
}

export function ledgerCsvEscape(value: string | number | null | undefined) {
	const text = value == null ? '' : String(value);
	if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
	return text;
}

export function transactionsToCsv(
	rows: Array<{ createdAt: string; who: string; type: string; description: string; amount: number }>
) {
	const header = ['createdAt', 'who', 'type', 'description', 'amount'];
	const lines = rows.map((row) =>
		[row.createdAt, row.who, row.type, row.description, row.amount].map(ledgerCsvEscape).join(',')
	);
	return [header.join(','), ...lines].join('\n');
}
