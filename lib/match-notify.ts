export type MatchNotifySide = { createdById: string; name: string };

export type MatchNotifyKind =
	| 'score_waiting'
	| 'score_completed'
	| 'score_dispute'
	| 'score_forced'
	| 'dispute_opened'
	| 'dispute_resolved';

export type MatchNotifyInput = {
	kind: MatchNotifyKind;
	actorId: string;
	tournamentId: string;
	tournamentTitle: string;
	ownerId?: string | null;
	refereeIds?: string[];
	matchId?: string;
	teamA?: MatchNotifySide | null;
	teamB?: MatchNotifySide | null;
	scoreA?: number;
	scoreB?: number;
	resolution?: string;
};

export type MatchNotifyRow = {
	userId: string;
	type: string;
	title: string;
	body: string;
	linkUrl: string;
};

export function otherCaptainId(
	actorId: string,
	teamA?: MatchNotifySide | null,
	teamB?: MatchNotifySide | null
) {
	if (teamA?.createdById === actorId) return teamB?.createdById ?? null;
	if (teamB?.createdById === actorId) return teamA?.createdById ?? null;
	return null;
}

function refereeNotifyList(input: Pick<MatchNotifyInput, 'ownerId' | 'refereeIds'>) {
	return Array.from(new Set([input.ownerId, ...(input.refereeIds ?? [])].filter((id): id is string => Boolean(id))));
}

export function bothCaptainIds(teamA?: MatchNotifySide | null, teamB?: MatchNotifySide | null) {
	return [teamA?.createdById, teamB?.createdById].filter((id): id is string => Boolean(id));
}

function actorTeamName(actorId: string, teamA?: MatchNotifySide | null, teamB?: MatchNotifySide | null) {
	if (teamA?.createdById === actorId) return teamA.name;
	if (teamB?.createdById === actorId) return teamB.name;
	return 'Судья';
}

export function matchNotifyRows(input: MatchNotifyInput): MatchNotifyRow[] {
	const linkUrl = input.matchId
		? `/tournaments/${input.tournamentId}#match-${input.matchId}`
		: `/tournaments/${input.tournamentId}`;
	const score =
		typeof input.scoreA === 'number' && typeof input.scoreB === 'number'
			? `${input.scoreA}:${input.scoreB}`
			: null;
	const actorName = actorTeamName(input.actorId, input.teamA, input.teamB);
	const opponent = otherCaptainId(input.actorId, input.teamA, input.teamB);
	const captains = bothCaptainIds(input.teamA, input.teamB);
	const recipients = new Set<string>();

	if (input.kind === 'score_waiting' || input.kind === 'score_completed') {
		if (opponent) recipients.add(opponent);
	}
	if (input.kind === 'score_dispute' || input.kind === 'dispute_opened') {
		if (opponent) recipients.add(opponent);
		for (const id of refereeNotifyList(input)) recipients.add(id);
	}
	if (input.kind === 'score_forced' || input.kind === 'dispute_resolved') {
		for (const id of captains) recipients.add(id);
	}

	recipients.delete(input.actorId);

	const copy = notifyCopy(input.kind, {
		title: input.tournamentTitle,
		actorName,
		score,
		resolution: input.resolution
	});

	return Array.from(recipients).map((userId) => ({
		userId,
		type: copy.type,
		title: copy.title,
		body: copy.body,
		linkUrl
	}));
}

function notifyCopy(
	kind: MatchNotifyKind,
	ctx: { title: string; actorName: string; score: string | null; resolution?: string }
) {
	const score = ctx.score ? ` Счёт ${ctx.score}.` : '';
	switch (kind) {
		case 'score_waiting':
			return {
				type: 'MATCH_REPORT',
				title: `Соперник сдал счёт: ${ctx.title}`,
				body: `${ctx.actorName} сдала счёт.${score} Подтвердите тот же результат или откройте спор.`
			};
		case 'score_completed':
			return {
				type: 'MATCH_RESULT',
				title: `Пара закрыта: ${ctx.title}`,
				body: `Оба капитана подтвердили счёт.${score}`
			};
		case 'score_dispute':
			return {
				type: 'MATCH_DISPUTE',
				title: `Спор по счёту: ${ctx.title}`,
				body: 'Капитаны сдали разный счёт. Приложите скрин или VOD — судья разберёт пару.'
			};
		case 'score_forced':
			return {
				type: 'MATCH_RESULT',
				title: `Судейский результат: ${ctx.title}`,
				body: `Судья зафиксировал итог пары.${score}`
			};
		case 'dispute_opened':
			return {
				type: 'MATCH_DISPUTE',
				title: `Открыт спор: ${ctx.title}`,
				body: `${ctx.actorName} открыла спор по паре. Нужен скрин, VOD и решение судьи.`
			};
		case 'dispute_resolved':
			return {
				type: 'MATCH_DISPUTE',
				title: `Спор закрыт: ${ctx.title}`,
				body: ctx.resolution?.trim() || 'Судья записал решение по спору.'
			};
	}
}
