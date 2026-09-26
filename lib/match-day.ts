import { applicationStatusLabel, tournamentStatusLabel } from '@/lib/tournament-copy';

export type MatchDayActionCode =
	| 'browse'
	| 'wait_review'
	| 'check_in'
	| 'wait_start'
	| 'ready'
	| 'post_lobby'
	| 'wait_lobby'
	| 'join_lobby'
	| 'report'
	| 'wait_rival'
	| 'dispute'
	| 'scrim'
	| 'watch'
	| 'recap'
	| 'done';

export type MatchDayAction = {
	code: MatchDayActionCode;
	label: string;
	hint: string;
	/** Captain/player must act now (vs passive wait). */
	mustAct?: boolean;
};

export type OpenMatchHint = {
	status: string;
	youReported: boolean;
	lobbyPosted?: boolean;
	isCaptain?: boolean;
	reportDeadlineLabel?: string | null;
};

export type SnapshotPlayer = {
	userId?: string;
	displayName: string;
	steamId?: string | null;
};

export function rosterFromSnapshot(snapshot: unknown): SnapshotPlayer[] {
	if (Array.isArray(snapshot)) {
		return snapshot.map((row) => rosterPerson(row)).filter((row): row is SnapshotPlayer => Boolean(row));
	}
	if (!snapshot || typeof snapshot !== 'object') return [];
	const record = snapshot as Record<string, unknown>;
	if (Array.isArray(record.players)) {
		return rosterFromSnapshot(record.players);
	}
	const indexed = Object.keys(record)
		.filter((key) => /^\d+$/.test(key))
		.sort((a, b) => Number(a) - Number(b))
		.map((key) => rosterPerson(record[key]))
		.filter((row): row is SnapshotPlayer => Boolean(row));
	return indexed;
}

function rosterPerson(value: unknown): SnapshotPlayer | null {
	if (!value || typeof value !== 'object') return null;
	const row = value as { userId?: unknown; displayName?: unknown; steamId?: unknown };
	if (typeof row.displayName !== 'string' || !row.displayName.trim()) return null;
	return {
		userId: typeof row.userId === 'string' ? row.userId : undefined,
		displayName: row.displayName.trim(),
		steamId: typeof row.steamId === 'string' ? row.steamId : null
	};
}

export function nextMatchDayAction(input: {
	tournamentStatus: string;
	applicationStatus: string;
	readyStatus?: string;
	startAt?: Date | string | null;
	now?: Date;
	openMatch?: OpenMatchHint | null;
	lastClosed?: { won: boolean } | null;
	checkInClosesLabel?: string | null;
}): MatchDayAction {
	const ready = input.readyStatus ?? 'PENDING';
	if (['REJECTED', 'WITHDRAWN', 'NO_CHECK_IN', 'DISQUALIFIED'].includes(input.applicationStatus)) {
		const missed =
			input.applicationStatus === 'NO_CHECK_IN' && input.checkInClosesLabel
				? ` Капитан не отметил до ${input.checkInClosesLabel} (МСК).`
				: '';
		return { code: 'done', label: 'Команда вне турнира', hint: `${applicationStatusLabel(input.applicationStatus)}${missed}` };
	}
	if (input.tournamentStatus === 'CANCELLED') {
		return { code: 'done', label: 'Турнир отменён', hint: 'Эта заявка больше не активна.' };
	}
	if (input.tournamentStatus === 'FINISHED') {
		return { code: 'done', label: 'Турнир завершён', hint: 'Пары закрыты. Смотрите итог на карточке турнира.' };
	}
	if (input.applicationStatus === 'NEEDS_ACTION') {
		return {
			code: 'wait_review',
			label: 'Исправить заявку',
			hint: 'Организатор вернул заявку. Капитан правит состав или данные и подаёт снова.',
			mustAct: true
		};
	}
	if (input.applicationStatus === 'SUBMITTED') {
		return { code: 'wait_review', label: 'Ждём решение орга', hint: 'Капитан подал состав. Организатор ещё не ответил.' };
	}
	if (input.tournamentStatus === 'CHECK_IN' && ['APPROVED', 'SUBMITTED'].includes(input.applicationStatus)) {
		const until = input.checkInClosesLabel ? ` до ${input.checkInClosesLabel} (МСК)` : '';
		return {
			code: 'check_in',
			label: 'Пройти check-in',
			hint: `Окно отметки открыто${until}. Капитан подтверждает явку пятёрки.`,
			mustAct: true
		};
	}
	const deadline = input.openMatch?.reportDeadlineLabel ? ` Дедлайн репорта: ${input.openMatch.reportDeadlineLabel}.` : '';
	if (input.openMatch?.status === 'NEEDS_REVIEW') {
		return {
			code: 'dispute',
			label: 'Добавить доказательство',
			hint: `Счета не совпали. Приложите скрин или VOD и ждите судью.${deadline}`,
			mustAct: true
		};
	}
	if (input.openMatch && input.openMatch.youReported && input.openMatch.status !== 'COMPLETED') {
		return { code: 'wait_rival', label: 'Ждём счёт соперника', hint: `Ваш капитан уже сдал счёт. Пара закроется, когда соперник подтвердит тот же результат.${deadline}` };
	}
	if (input.openMatch && !['COMPLETED', 'TECHNICAL'].includes(input.openMatch.status) && !input.openMatch.lobbyPosted) {
		if (input.openMatch.isCaptain === false) {
			return { code: 'wait_lobby', label: 'Ждём лобби от капитана', hint: 'Пара есть. Капитан ещё не выложил имя лобби и пароль — без них в одну катку не зайти.' };
		}
		return { code: 'post_lobby', label: 'Выложить лобби', hint: 'Создайте лобби в Dota 2 и напишите имя, пароль и сервер. Состав и соперник увидят это на сайте.', mustAct: true };
	}
	if (input.openMatch && !['COMPLETED', 'TECHNICAL'].includes(input.openMatch.status) && input.openMatch.lobbyPosted && input.openMatch.isCaptain === false) {
		return { code: 'join_lobby', label: 'Открыть лобби', hint: 'Капитан выложил лобби. Имя, пароль и голосовой — на карточке турнира.', mustAct: true };
	}
	if (input.openMatch && !['COMPLETED', 'TECHNICAL'].includes(input.openMatch.status)) {
		return { code: 'report', label: 'Отправить счёт', hint: `Лобби есть. После катки капитан вводит счёт. Соперник должен сдать тот же.${deadline}`, mustAct: true };
	}
	if (!input.openMatch && input.lastClosed) {
		return input.lastClosed.won
			? { code: 'recap', label: 'Вышли дальше', hint: 'Пара закрыта. +16 рейтинга арены записаны. Следующий шаг — на карточке турнира.' }
			: { code: 'recap', label: 'Пара закрыта', hint: '−12 рейтинга арены записаны. Почему нет бейджа Plus — в рекапе ниже.' };
	}
	if (['CHECKED_IN', 'IN_BRACKET', 'APPROVED'].includes(input.applicationStatus) && ready === 'PENDING' && isTournamentDay(input.startAt, input.now)) {
		return { code: 'ready', label: 'Я готов', hint: 'Сегодня день турнира. Нажмите «Я готов» или снимите команду.', mustAct: true };
	}
	if (['CHECKED_IN', 'IN_BRACKET', 'APPROVED'].includes(input.applicationStatus) && ready !== 'READY') {
		return { code: 'wait_start', label: 'Ждём день старта', hint: 'Состав принят. Уведомление «готов / не готов» придёт в день турнира.' };
	}
	if (input.tournamentStatus === 'LIVE') {
		return { code: 'watch', label: 'Смотреть сетку', hint: 'Готовность есть. Откройте карточку турнира, когда появится пара.' };
	}
	return {
		code: 'browse',
		label: tournamentStatusLabel(input.tournamentStatus),
		hint: 'Откройте карточку турнира, чтобы увидеть заявку и пары.'
	};
}

export type MatchDayStepState = 'done' | 'current' | 'todo';

export type MatchDayStep = {
	id: 'review' | 'check_in' | 'ready' | 'lobby' | 'score';
	label: string;
	state: MatchDayStepState;
};

export function buildMatchDayChecklist(input: Parameters<typeof nextMatchDayAction>[0]): MatchDayStep[] {
	const code = nextMatchDayAction(input).code;
	const order: MatchDayActionCode[] = [
		'wait_review',
		'check_in',
		'wait_start',
		'ready',
		'post_lobby',
		'wait_lobby',
		'join_lobby',
		'report',
		'wait_rival',
		'dispute',
		'watch',
		'recap',
		'done',
		'browse'
	];
	const rank = order.indexOf(code);
	function state(after: MatchDayActionCode, current: MatchDayActionCode[]): MatchDayStepState {
		if (current.includes(code)) return 'current';
		return rank >= 0 && rank > order.indexOf(after) ? 'done' : 'todo';
	}
	return [
		{ id: 'review', label: 'Заявка', state: state('wait_review', ['wait_review']) },
		{ id: 'check_in', label: 'Отметка', state: state('check_in', ['check_in']) },
		{ id: 'ready', label: 'Готовность', state: state('ready', ['wait_start', 'ready']) },
		{ id: 'lobby', label: 'Лобби', state: state('join_lobby', ['post_lobby', 'wait_lobby', 'join_lobby']) },
		{ id: 'score', label: 'Счёт', state: state('dispute', ['report', 'wait_rival', 'dispute', 'watch', 'recap', 'done']) }
	];
}

export function matchDayHref(baseHref: string, code: MatchDayActionCode, matchId?: string | null) {
	if (matchId && ['post_lobby', 'wait_lobby', 'join_lobby', 'report', 'wait_rival', 'dispute', 'recap'].includes(code)) {
		return `${baseHref.split('#', 1)[0]}#match-${matchId}`;
	}
	if (code === 'check_in' || code === 'ready' || code === 'wait_review') return baseHref;
	if (code === 'watch') return `${baseHref}#bracket`;
	return baseHref;
}

export function isTournamentDay(startAt?: Date | string | null, now = new Date()) {
	if (!startAt) return false;
	const start = typeof startAt === 'string' ? startAt : startAt.toISOString();
	return now.toISOString().slice(0, 10) >= start.slice(0, 10);
}

export function pickActionTeamId(
	teams: Array<{ id: string }>,
	applications: Array<{ teamId?: string; team?: { id?: string } }>,
	selected?: string
) {
	const applied = new Set(
		applications.map((app) => app.teamId || app.team?.id).filter((id): id is string => Boolean(id))
	);
	if (selected && applied.has(selected)) return selected;
	return teams.find((team) => applied.has(team.id))?.id ?? teams[0]?.id ?? '';
}

export function pickOpenMatch<T extends { status: string; winnerTeamId?: string | null }>(matches: T[]): T | null {
	return (
		matches.find((match) => match.status === 'NEEDS_REVIEW') ||
		matches.find((match) => !['COMPLETED', 'TECHNICAL'].includes(match.status) && !match.winnerTeamId) ||
		null
	);
}
