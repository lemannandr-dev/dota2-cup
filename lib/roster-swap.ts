import { rosterFromSnapshot, type SnapshotPlayer } from '@/lib/match-day';

export type RosterPlayer = {
	userId: string;
	steamId: string | null;
	displayName: string;
};

export type RosterSwapInput = {
	tournamentStatus: string;
	applicationStatus: string;
	outUserId: string;
	incoming: { userId: string; confirmed: boolean; steamId: string | null; displayName: string };
	currentSnapshot: unknown;
	incomingOnOtherTeam: boolean;
	pairInProgress: boolean;
};

export type RosterSwapOk = {
	ok: true;
	players: RosterPlayer[];
	snapshot: Record<string, unknown>;
	out: RosterPlayer;
	incoming: RosterPlayer;
};

export type RosterSwapErr = { ok: false; error: string };

export function reportedTeamIdsOf(match: { reports?: Array<{ teamId: string }> | null }): string[] {
	return (match.reports ?? []).map((row) => row.teamId);
}

export function pairBlocksRosterSwap(
	match: {
		status: string;
		teamAId?: string | null;
		teamBId?: string | null;
		reportedTeamIds?: string[];
		frozenA?: boolean;
		frozenB?: boolean;
	},
	teamId: string
) {
	if (match.teamAId !== teamId && match.teamBId !== teamId) return false;
	if (['COMPLETED', 'TECHNICAL'].includes(match.status)) return false;
	if (match.status === 'NEEDS_REVIEW') return true;
	if ((match.reportedTeamIds ?? []).length > 0) return true;
	return match.teamAId === teamId ? Boolean(match.frozenA) : Boolean(match.frozenB);
}

export function shouldFreezeHistoricalMatch(status: string, hasReports: boolean) {
	return ['COMPLETED', 'TECHNICAL', 'NEEDS_REVIEW'].includes(status) || hasReports;
}

export function displayedRoster(frozen: unknown, live: unknown): SnapshotPlayer[] {
	const locked = rosterFromSnapshot(frozen);
	if (locked.length > 0) return locked;
	return rosterFromSnapshot(live);
}

export function decideRosterSwap(input: RosterSwapInput): RosterSwapOk | RosterSwapErr {
	if (!['CHECK_IN', 'LIVE'].includes(input.tournamentStatus)) {
		return { ok: false, error: 'Замену можно сделать после отметки, пока турнир идёт' };
	}
	if (!['CHECKED_IN', 'IN_BRACKET'].includes(input.applicationStatus)) {
		return { ok: false, error: 'Сначала отметьте состав. Замена — только после check-in' };
	}
	if (input.pairInProgress) {
		return { ok: false, error: 'Пара уже началась: счёт сдан или спор открыт. Состав этой пары заморожен' };
	}
	if (input.outUserId === input.incoming.userId) {
		return { ok: false, error: 'Нельзя заменить игрока самим собой' };
	}
	if (!input.incoming.confirmed) {
		return { ok: false, error: 'Запасной должен подтвердить участие в команде' };
	}
	if (!input.incoming.steamId) {
		return { ok: false, error: 'У запасного должен быть Steam' };
	}
	if (input.incomingOnOtherTeam) {
		return { ok: false, error: 'Этот игрок уже заявлен в этом турнире за другую команду' };
	}

	const current = rosterFromSnapshot(input.currentSnapshot);
	const players: RosterPlayer[] = [];
	for (const row of current) {
		if (!row.userId) continue;
		players.push({
			userId: row.userId,
			steamId: row.steamId ?? null,
			displayName: row.displayName
		});
	}
	if (players.length !== 5) {
		return { ok: false, error: 'В заявке должно быть ровно 5 игроков' };
	}

	const outIndex = players.findIndex((row) => row.userId === input.outUserId);
	if (outIndex < 0) {
		return { ok: false, error: 'Этого игрока нет в заявленной пятёрке' };
	}
	if (players.some((row) => row.userId === input.incoming.userId)) {
		return { ok: false, error: 'Запасной уже в заявленной пятёрке' };
	}

	const out = players[outIndex];
	const incoming: RosterPlayer = {
		userId: input.incoming.userId,
		steamId: input.incoming.steamId,
		displayName: input.incoming.displayName
	};
	const nextPlayers = players.map((row, index) => (index === outIndex ? incoming : row));
	const steamIds = nextPlayers.map((row) => row.steamId).filter((id): id is string => Boolean(id));
	if (steamIds.length !== 5 || new Set(steamIds).size !== 5) {
		return { ok: false, error: 'После замены у всех пяти должен быть уникальный Steam' };
	}

	return {
		ok: true,
		players: nextPlayers,
		out,
		incoming,
		snapshot: writeRosterSnapshot(input.currentSnapshot, nextPlayers, {
			outUserId: out.userId,
			inUserId: incoming.userId
		})
	};
}

export function writeRosterSnapshot(
	previous: unknown,
	players: RosterPlayer[],
	swap?: { outUserId: string; inUserId: string }
) {
	const record = previous && typeof previous === 'object' && !Array.isArray(previous) ? (previous as Record<string, unknown>) : {};
	const swaps = Array.isArray(record.swaps) ? [...record.swaps] : [];
	if (swap) {
		swaps.push({ ...swap, at: new Date().toISOString() });
	}
	return {
		players,
		readiness: record.readiness ?? undefined,
		swaps
	};
}
