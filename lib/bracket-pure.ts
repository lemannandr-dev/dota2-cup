export function nextPowerOfTwo(n: number): number {
	let p = 1;
	while (p < n) p *= 2;
	return p;
}

/** Standard seeding order (1 vs lowest). Size 8: [1, 8, 4, 5, 2, 7, 3, 6] */
export function seedOrder(size: number): number[] {
	let order = [1];
	while (order.length < size) {
		const next: number[] = [];
		const len = order.length * 2;
		for (const s of order) {
			next.push(s);
			next.push(len + 1 - s);
		}
		order = next;
	}
	return order;
}

export function winsNeeded(bestOf: number): number {
	return Math.floor(bestOf / 2) + 1;
}

export function validateSeriesScore(bestOf: number, scoreA: number, scoreB: number): string | null {
	if (scoreA === scoreB) return 'Draws are not allowed';
	const need = winsNeeded(bestOf);
	if (scoreA < need && scoreB < need) return `Series not finished for BO${bestOf}`;
	if (scoreA > need || scoreB > need) return `Score exceeds BO${bestOf}`;
	if (scoreA + scoreB > bestOf) return `Score exceeds BO${bestOf}`;
	return null;
}

export function winnerFromScores(teamAId: string, teamBId: string, scoreA: number, scoreB: number): string {
	return scoreA > scoreB ? teamAId : teamBId;
}

export function seriesBestOf(seriesRules: string): number {
	const upper = seriesRules.toUpperCase();
	if (upper.includes('BO5')) return 5;
	if (upper.includes('BO3')) return 3;
	return 1;
}
