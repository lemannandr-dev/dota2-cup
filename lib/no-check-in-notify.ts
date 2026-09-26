export type NoCheckInNotifyRow = {
	userId: string;
	type: 'TOURNAMENT_NO_CHECK_IN';
	title: string;
	body: string;
	linkUrl: string;
};

export function noCheckInNotifyRows(input: {
	tournamentId: string;
	title: string;
	userIds: string[];
	closesLabel?: string | null;
}): NoCheckInNotifyRow[] {
	const unique = [...new Set(input.userIds.filter(Boolean))];
	const until = input.closesLabel ? ` до ${input.closesLabel} (МСК)` : '';
	return unique.map((userId) => ({
		userId,
		type: 'TOURNAMENT_NO_CHECK_IN',
		title: `Вы выбыли: ${input.title}`,
		body: `Капитан не отметил состав${until}. Окно закрылось — команда не в сетке.`,
		linkUrl: '/home'
	}));
}
