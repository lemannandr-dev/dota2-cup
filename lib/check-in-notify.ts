export type CheckInNotifyRow = {
	userId: string;
	type: 'TOURNAMENT_CHECK_IN';
	title: string;
	body: string;
	linkUrl: string;
};

export function checkInNotifyRows(input: { tournamentId: string; title: string; userIds: string[] }): CheckInNotifyRow[] {
	const unique = [...new Set(input.userIds.filter(Boolean))];
	return unique.map((userId) => ({
		userId,
		type: 'TOURNAMENT_CHECK_IN',
		title: `Отметка состава: ${input.title}`,
		body: 'Окно отметки открыто. Капитан подтверждает явку пятёрки на карточке турнира.',
		linkUrl: `/tournaments/${input.tournamentId}`
	}));
}
