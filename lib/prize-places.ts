export type FinalMatchLike = {
	bracket: string;
	winnerTeamId: string | null;
	teamAId: string | null;
	teamBId: string | null;
	nextMatchId?: string | null;
};

export function pickFinalMatch<T extends FinalMatchLike>(matches: T[]): T | undefined {
	return (
		matches.find((match) => match.bracket === 'grand' && match.winnerTeamId) ||
		matches.find((match) => match.bracket === 'winners' && !match.nextMatchId && match.winnerTeamId)
	);
}

export function placeTeamsFromFinal(finalMatch: FinalMatchLike): Record<number, string | null> {
	const winner = finalMatch.winnerTeamId;
	const runnerUp = winner === finalMatch.teamAId ? finalMatch.teamBId : finalMatch.teamAId;
	return { 1: winner, 2: runnerUp ?? null };
}

export function shouldSkipPrizeAllocation(status: string, amount: number) {
	return status !== 'RESERVED' || amount <= 0;
}

export function formatPrizeAmount(kopecks: number, currency = 'RUB') {
	return `${(kopecks / 100).toLocaleString('ru-RU')} ${currency === 'RUB' ? '₽' : currency}`;
}

export function defaultPlaceSplit(prizePool: number): Array<{ place: number; amount: number }> {
	if (prizePool <= 0) return [];
	const first = Math.round(prizePool * 0.7);
	const second = prizePool - first;
	return [
		{ place: 1, amount: first },
		{ place: 2, amount: second }
	].filter((row) => row.amount > 0);
}

export type EscrowWallet = {
	have: number;
	needed: number;
	shortfall: number;
	canAfford: boolean;
	haveLabel: string;
	neededLabel: string;
	shortfallLabel: string;
};

export function describeEscrowWallet(input: { prizePool: number; balance: number; currency?: string }): EscrowWallet {
	const currency = input.currency ?? 'RUB';
	const needed = Math.max(0, input.prizePool);
	const have = input.balance;
	const shortfall = Math.max(0, needed - have);
	return {
		have,
		needed,
		shortfall,
		canAfford: shortfall === 0 && needed > 0,
		haveLabel: formatPrizeAmount(have, currency),
		neededLabel: formatPrizeAmount(needed, currency),
		shortfallLabel: formatPrizeAmount(shortfall, currency)
	};
}

export function escrowReserveHint(wallet: EscrowWallet) {
	if (wallet.needed <= 0) return 'Призового фонда нет — резервировать нечего.';
	if (wallet.shortfall > 0) {
		return `Фонд не зарезервирован. На кошельке ${wallet.haveLabel}, нужно ${wallet.neededLabel}. Не хватает ${wallet.shortfallLabel} — пополните баланс, деньги из воздуха не печатаем.`;
	}
	return `Фонд не зарезервирован. На кошельке хватает ${wallet.neededLabel} — спишите в эскроу кодом ключа, иначе выплатить будет нечего.`;
}

export function canActAsEscrowOwner(input: { actorId: string; ownerId: string | null; actorRole?: string | null }) {
	if (!input.ownerId) return false;
	if (input.actorId === input.ownerId) return true;
	return input.actorRole === 'ADMIN';
}

export type PayoutLine = {
	place: number;
	amount: number;
	amountLabel: string;
	teamId: string | null;
	teamName: string | null;
	status: string;
	payable: boolean;
};

export type PayoutPreview = {
	canPay: boolean;
	canReserve: boolean;
	escrowReady: boolean;
	alreadyPaid: boolean;
	reason: 'not_finished' | 'no_winner' | 'unconfirmed' | 'no_prize' | 'already_paid' | null;
	hint: string;
	lines: PayoutLine[];
	totalLabel: string;
	wallet: EscrowWallet;
};

export function buildPayoutPreview(input: {
	tournamentStatus: string;
	prizeStatus: string;
	prizePool?: number;
	organizerBalance?: number;
	prizeCurrency?: string;
	allocations: Array<{ place: number; amount: number; status: string; teamId?: string | null }>;
	finalMatch?: FinalMatchLike | null;
	teamNames?: Record<string, string>;
	actorId?: string;
	ownerId?: string | null;
	actorRole?: string | null;
}): PayoutPreview {
	const currency = input.prizeCurrency ?? 'RUB';
	const prizePool = input.prizePool ?? input.allocations.reduce((sum, row) => sum + row.amount, 0);
	const wallet = describeEscrowWallet({
		prizePool,
		balance: input.organizerBalance ?? 0,
		currency
	});
	const places = input.finalMatch ? placeTeamsFromFinal(input.finalMatch) : {};
	const sourceAllocations =
		input.allocations.length === 0 && input.prizeStatus === 'UNCONFIRMED' && prizePool > 0
			? defaultPlaceSplit(prizePool).map((row) => ({ ...row, status: 'PENDING', teamId: null }))
			: input.allocations;
	const lines = [...sourceAllocations]
		.sort((a, b) => a.place - b.place)
		.map((row) => {
			const teamId = places[row.place] ?? row.teamId ?? null;
			return {
				place: row.place,
				amount: row.amount,
				amountLabel: formatPrizeAmount(row.amount, currency),
				teamId,
				teamName: teamId ? input.teamNames?.[teamId] ?? null : null,
				status: row.status,
				payable: !shouldSkipPrizeAllocation(row.status, row.amount) && Boolean(teamId)
			};
		});
	const payable = lines.some((line) => line.payable);
	const alreadyPaid = lines.length > 0 && lines.every((line) => line.status === 'PAID' || line.amount <= 0);
	const gate = canPayTournamentPrizes(input.tournamentStatus, input.finalMatch);
	const ownerOk =
		input.actorId == null ||
		canActAsEscrowOwner({ actorId: input.actorId, ownerId: input.ownerId ?? null, actorRole: input.actorRole });
	let reason: PayoutPreview['reason'] = null;
	let hint = 'Капитаны 1 и 2 места получат сумму на баланс арены. Повторно те же места не начисляются.';
	if (input.prizeStatus === 'NONE' || (sourceAllocations.length === 0 && input.prizeStatus !== 'UNCONFIRMED')) {
		reason = 'no_prize';
		hint = 'Призового фонда нет — выплачивать нечего.';
	} else if (input.prizeStatus === 'UNCONFIRMED') {
		reason = gate.ok ? 'unconfirmed' : gate.reason;
		hint = escrowReserveHint(wallet);
		if (!gate.ok && gate.reason === 'not_finished') {
			hint = `${hint} Выплата — только после финала.`;
		}
	} else if (!gate.ok) {
		reason = gate.reason;
		hint =
			gate.reason === 'not_finished'
				? 'Выплата только после статуса «Завершён».'
				: 'Победитель финала ещё не записан.';
	} else if (alreadyPaid) {
		reason = 'already_paid';
		hint = 'Эти призы уже на балансе капитанов. Повторно не платим.';
	} else if (input.prizeStatus !== 'CONFIRMED') {
		reason = 'unconfirmed';
		hint = escrowReserveHint(wallet);
	} else if (!payable) {
		reason = 'no_winner';
		hint = 'Места есть, но команды ещё не сопоставлены с финалом.';
	}
	return {
		canPay: reason === null && payable,
		canReserve: input.prizeStatus === 'UNCONFIRMED' && ownerOk,
		escrowReady: input.prizeStatus === 'CONFIRMED',
		alreadyPaid,
		reason,
		hint,
		lines,
		wallet,
		totalLabel: formatPrizeAmount(
			lines.reduce((sum, line) => sum + line.amount, 0),
			currency
		)
	};
}

export type PayPrizesGate =
	| { ok: true; finalMatch: FinalMatchLike }
	| { ok: false; reason: 'not_finished' | 'no_winner' };

export function canPayTournamentPrizes(status: string, finalMatch?: FinalMatchLike | null): PayPrizesGate {
	if (status !== 'FINISHED') return { ok: false, reason: 'not_finished' };
	if (!finalMatch?.winnerTeamId) return { ok: false, reason: 'no_winner' };
	return { ok: true, finalMatch };
}
