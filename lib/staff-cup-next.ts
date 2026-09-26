export type StaffCupNext = {
	href: string;
	label: string;
	hint: string;
	code: 'applications' | 'disputes' | 'matches' | 'none';
};

type ApplicationLike = { status: string };
type MatchLike = {
	id: string;
	status: string;
	reportDeadlineAt?: Date | string | null;
	disputes?: Array<{ status: string }>;
};

/** First sticky action for tournament staff on the cup page. */
export function nextStaffCupAction(input: {
	tournamentId: string;
	applications: ApplicationLike[];
	matches: MatchLike[];
	now?: Date;
}): StaffCupNext {
	const now = input.now ?? new Date();
	const pendingApps = input.applications.filter((row) => row.status === 'SUBMITTED' || row.status === 'NEEDS_ACTION');
	if (pendingApps.length > 0) {
		return {
			code: 'applications',
			href: `#applications`,
			label: `Заявки · ${pendingApps.length}`,
			hint: 'Одобрите или отклоните составы'
		};
	}

	const openDisputes = input.matches.filter((match) =>
		(match.disputes ?? []).some((d) => d.status === 'OPEN') || match.status === 'NEEDS_REVIEW'
	);
	if (openDisputes.length > 0) {
		const first = openDisputes[0];
		return {
			code: 'disputes',
			href: `#match-${first.id}`,
			label: `Споры · ${openDisputes.length}`,
			hint: 'Разберите расхождение счёта'
		};
	}

	const overdue = input.matches.filter((match) => {
		if (['COMPLETED', 'TECHNICAL', 'CANCELLED'].includes(match.status)) return false;
		if (!match.reportDeadlineAt) return false;
		const at = typeof match.reportDeadlineAt === 'string' ? Date.parse(match.reportDeadlineAt) : match.reportDeadlineAt.getTime();
		return Number.isFinite(at) && at < now.getTime();
	});
	if (overdue.length > 0) {
		return {
			code: 'matches',
			href: `#match-${overdue[0].id}`,
			label: `Просрочка · ${overdue.length}`,
			hint: 'Пара ждёт репорт или решение'
		};
	}

	return {
		code: 'none',
		href: `#matches`,
		label: 'Сетка кубка',
		hint: 'Очереди проблем нет'
	};
}
