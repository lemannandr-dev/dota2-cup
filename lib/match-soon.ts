export const MATCH_SOON_WINDOW_MS = 30 * 60_000;
export const MATCH_SOON_TYPE = 'MATCH_SOON';

export function isMatchSoonWindow(startAt: Date | string, now = new Date(), windowMs = MATCH_SOON_WINDOW_MS) {
	const start = typeof startAt === 'string' ? Date.parse(startAt) : startAt.getTime();
	if (!Number.isFinite(start)) return false;
	const left = start - now.getTime();
	return left > 0 && left <= windowMs;
}

export type MatchSoonRow = {
	userId: string;
	type: typeof MATCH_SOON_TYPE;
	title: string;
	body: string;
	linkUrl: string;
};

export function matchSoonNotifyRows(input: { tournamentId: string; title: string; userIds: string[] }): MatchSoonRow[] {
	const unique = [...new Set(input.userIds.filter(Boolean))];
	return unique.map((userId) => ({
		userId,
		type: MATCH_SOON_TYPE,
		title: `Скоро катка: ${input.title}`,
		body: 'До старта меньше получаса. Откройте карточку: лобби, пароль и голосовой.',
		linkUrl: `/tournaments/${input.tournamentId}`
	}));
}
