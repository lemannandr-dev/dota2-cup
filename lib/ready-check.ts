export type ReadySlotState = 'ready' | 'pending' | 'declined' | 'empty';

export type ReadySlotMedal = {
	tier: import('@/lib/dota-rank').HeaderRankMedal['tier'];
	stars?: import('@/lib/dota-rank').HeaderRankMedal['stars'];
	leaderboard?: number;
};

export type ReadySlot = {
	displayName: string | null;
	avatarUrl: string | null;
	state: ReadySlotState;
	userId?: string | null;
	profileHref?: string | null;
	rankLabel?: string | null;
	medal?: ReadySlotMedal | null;
};

export type ReadyCheckSide = {
	teamName: string | null;
	readyStatus: string;
	slots: ReadySlot[];
};

export type ReadyCheckBoard = {
	label: string;
	hint: string;
	readyCount: number;
	total: number;
	sideA: ReadyCheckSide;
	sideB: ReadyCheckSide;
};

const SIDE_SIZE = 5;

export type ReadyStripPlayer = {
	displayName: string;
	avatarUrl?: string | null;
	userId?: string | null;
	profileHref?: string | null;
	rankLabel?: string | null;
	medal?: ReadySlotMedal | null;
};

export function playersForReadyStrip(
	snapshotPlayers: Array<{ userId?: string; displayName: string }>,
	members: Array<{
		userId?: string;
		displayName: string;
		avatarUrl?: string | null;
		confirmed?: boolean;
		isSubstitute?: boolean;
		rankLabel?: string | null;
		medal?: ReadySlotMedal | null;
	}>
): ReadyStripPlayer[] {
	const byId = new Map(
		members
			.filter((member) => member.userId)
			.map((member) => [
				member.userId as string,
				{
					avatarUrl: member.avatarUrl ?? null,
					rankLabel: member.rankLabel ?? null,
					medal: member.medal ?? null
				}
			])
	);
	if (snapshotPlayers.length > 0) {
		return snapshotPlayers.map((player) => {
			const meta = player.userId ? byId.get(player.userId) : undefined;
			return {
				displayName: player.displayName,
				avatarUrl: meta?.avatarUrl ?? null,
				userId: player.userId ?? null,
				profileHref: player.userId ? `/profile/${player.userId}` : null,
				rankLabel: meta?.rankLabel ?? null,
				medal: meta?.medal ?? null
			};
		});
	}
	return members
		.filter((member) => member.confirmed !== false && member.isSubstitute !== true && member.displayName.trim())
		.slice(0, 5)
		.map((member) => ({
			displayName: member.displayName,
			avatarUrl: member.avatarUrl ?? null,
			userId: member.userId ?? null,
			profileHref: member.userId ? `/profile/${member.userId}` : null,
			rankLabel: member.rankLabel ?? null,
			medal: member.medal ?? null
		}));
}

export function padReadySlots(players: ReadyStripPlayer[], readyStatus: string, size = SIDE_SIZE): ReadySlot[] {
	const state: ReadySlotState =
		readyStatus === 'READY' ? 'ready' : readyStatus === 'DECLINED' ? 'declined' : 'pending';
	return Array.from({ length: size }, (_, index) => {
		const player = players[index];
		if (!player) return { displayName: null, avatarUrl: null, state: 'empty' };
		return {
			displayName: player.displayName,
			avatarUrl: player.avatarUrl ?? null,
			state,
			userId: player.userId ?? null,
			profileHref: player.profileHref ?? null,
			rankLabel: player.rankLabel ?? null,
			medal: player.medal ?? null
		};
	});
}

export function buildReadyCheck(input: {
	teamA?: { name?: string | null; readyStatus?: string; players?: ReadyStripPlayer[] } | null;
	teamB?: { name?: string | null; readyStatus?: string; players?: ReadyStripPlayer[] } | null;
}): ReadyCheckBoard {
	const sideA: ReadyCheckSide = {
		teamName: input.teamA?.name ?? null,
		readyStatus: input.teamA?.readyStatus ?? 'PENDING',
		slots: padReadySlots(input.teamA?.players ?? [], input.teamA?.readyStatus ?? 'PENDING')
	};
	const sideB: ReadyCheckSide = {
		teamName: input.teamB?.name ?? null,
		readyStatus: input.teamB?.readyStatus ?? 'PENDING',
		slots: padReadySlots(input.teamB?.players ?? [], input.teamB?.readyStatus ?? 'PENDING')
	};
	const slots = [...sideA.slots, ...sideB.slots];
	const readyCount = slots.filter((slot) => slot.state === 'ready').length;
	const filled = slots.filter((slot) => slot.state !== 'empty').length;
	return {
		label: `Готово: ${readyCount}/${filled || slots.length}`,
		hint: 'Готовность команды на арене. Это не accept в клиенте Dota и не GSI.',
		readyCount,
		total: filled || slots.length,
		sideA,
		sideB
	};
}

/** Guard: no shared player between sides of a pair. */
export function readySidesDisjoint(board: ReadyCheckBoard): boolean {
	const idsA = board.sideA.slots.map((slot) => slot.userId).filter(Boolean);
	const idsB = board.sideB.slots.map((slot) => slot.userId).filter(Boolean);
	const namesA = board.sideA.slots.map((slot) => slot.displayName).filter(Boolean);
	const namesB = board.sideB.slots.map((slot) => slot.displayName).filter(Boolean);
	return !idsA.some((id) => idsB.includes(id)) && !namesA.some((name) => namesB.includes(name));
}
