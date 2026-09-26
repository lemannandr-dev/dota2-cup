export type HandshakeState =
	| 'waiting_opponent'
	| 'ready'
	| 'waiting_rival'
	| 'confirmed'
	| 'disputed'
	| 'done';

export function matchHandshake(input: {
	status: string;
	teamAId?: string | null;
	teamBId?: string | null;
	reportedTeamIds?: string[];
	winnerTeamId?: string | null;
}): { state: HandshakeState; label: string; waitingName?: 'A' | 'B' | 'both' } {
	if (input.status === 'NEEDS_REVIEW') {
		return { state: 'disputed', label: 'Счета не совпали · ждёт судью' };
	}
	if (input.status === 'COMPLETED' || input.status === 'TECHNICAL' || input.winnerTeamId) {
		return { state: 'confirmed', label: 'Обе команды подтвердили · пара закрыта' };
	}
	if (!input.teamAId || !input.teamBId) {
		return { state: 'waiting_opponent', label: 'Ждём соперника в сетке', waitingName: 'both' };
	}
	const reports = new Set(input.reportedTeamIds ?? []);
	const a = input.teamAId ? reports.has(input.teamAId) : false;
	const b = input.teamBId ? reports.has(input.teamBId) : false;
	if (a && b) return { state: 'confirmed', label: 'Обе команды приняли счёт' };
	if (a && !b) return { state: 'waiting_rival', label: 'Команда A сдала счёт · ждём соперника', waitingName: 'B' };
	if (!a && b) return { state: 'waiting_rival', label: 'Команда B сдала счёт · ждём соперника', waitingName: 'A' };
	return { state: 'ready', label: 'Пара готова · обе команды ещё не сдали счёт', waitingName: 'both' };
}

export type ApplicationLane = 'waiting' | 'accepted' | 'hold' | 'ready' | 'placed' | 'out';

export function applicationLane(
	status: string,
	readyStatus: string = 'PENDING',
	opts?: { startAt?: Date | string | null; now?: Date; tournamentStatus?: string }
): ApplicationLane {
	if (readyStatus === 'DECLINED' || ['REJECTED', 'WITHDRAWN', 'NO_CHECK_IN', 'DISQUALIFIED'].includes(status)) {
		return 'out';
	}
	if (opts?.tournamentStatus === 'CANCELLED') return 'out';
	if (opts?.tournamentStatus === 'FINISHED') {
		if (status === 'IN_BRACKET' || status === 'CHECKED_IN') return 'placed';
		return 'out';
	}
	if (status === 'SUBMITTED' || status === 'NEEDS_ACTION' || status === 'DRAFT') return 'waiting';
	if (status === 'APPROVED') return 'accepted';
	if (status === 'CHECKED_IN' || status === 'IN_BRACKET') {
		if (readyStatus === 'READY') return 'ready';
		return 'hold';
	}
	return 'out';
}

export function applicationPlaceLabel(place?: number | null) {
	if (place === 1) return '1 место';
	if (place === 2) return '2 место';
	return 'Сыграли';
}
