import { isMatchSoonWindow, MATCH_SOON_WINDOW_MS } from '@/lib/match-soon';

export const PAIR_SOON_TYPE = 'PAIR_SOON';

export function pairSoonDue(input: {
	status: string;
	teamAId?: string | null;
	teamBId?: string | null;
	startedAt?: Date | string | null;
	reportDeadlineAt?: Date | string | null;
	now?: Date;
}) {
	if (!input.teamAId || !input.teamBId) return false;
	if (!['SCHEDULED', 'LIVE', 'PENDING'].includes(input.status)) return false;
	if (input.startedAt && isMatchSoonWindow(input.startedAt, input.now, MATCH_SOON_WINDOW_MS)) return true;
	return Boolean(input.reportDeadlineAt) && ['SCHEDULED', 'LIVE'].includes(input.status);
}

export function pairSoonNotifyRows(input: {
	tournamentId: string;
	matchId: string;
	title: string;
	userIds: string[];
	teamAName?: string | null;
	teamBName?: string | null;
}) {
	const unique = [...new Set(input.userIds.filter(Boolean))];
	const pair = [input.teamAName, input.teamBName].filter(Boolean).join(' — ') || 'ваша пара';
	return unique.map((userId) => ({
		userId,
		type: PAIR_SOON_TYPE,
		title: `Пара назначена: ${input.title}`,
		body: `${pair}. Откройте карточку: лобби, пароль и счёт — у капитана или заместителя.`,
		linkUrl: `/tournaments/${input.tournamentId}#match-${input.matchId}`
	}));
}
