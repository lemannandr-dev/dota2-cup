export type ApplicationReviewStatus = 'APPROVED' | 'REJECTED' | 'NEEDS_ACTION';

export type ApplicationReviewNotifyRow = {
	userId: string;
	type: 'APPLICATION_REVIEW';
	title: string;
	body: string;
	linkUrl: string;
};

const TITLE: Record<ApplicationReviewStatus, (cup: string) => string> = {
	APPROVED: (cup) => `Заявка принята: ${cup}`,
	REJECTED: (cup) => `Заявка отклонена: ${cup}`,
	NEEDS_ACTION: (cup) => `Поправьте состав: ${cup}`
};

const BODY: Record<ApplicationReviewStatus, string> = {
	APPROVED: 'Организатор принял пятёрку. Дальше — отметка в окне чек-ина на карточке кубка.',
	REJECTED: 'Организатор отклонил заявку. Причина, если была, в этом письме ниже.',
	NEEDS_ACTION: 'Организатор просит поправить состав или данные заявки.'
};

export function applicationReviewNotifyRows(input: {
	tournamentId: string;
	title: string;
	status: ApplicationReviewStatus;
	userIds: string[];
	note?: string | null;
}): ApplicationReviewNotifyRow[] {
	const unique = [...new Set(input.userIds.filter(Boolean))];
	const note = input.note?.trim();
	const body = note ? `${BODY[input.status]} ${note}` : BODY[input.status];
	return unique.map((userId) => ({
		userId,
		type: 'APPLICATION_REVIEW',
		title: TITLE[input.status](input.title),
		body,
		linkUrl: `/tournaments/${input.tournamentId}`
	}));
}
