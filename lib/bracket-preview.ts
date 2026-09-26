import { nextPowerOfTwo, seedOrder } from '@/lib/bracket-pure';

export type PreviewTeam = { teamId: string; name: string; seed: number };

export type PreviewPair = {
	position: number;
	teamA: { id: string; name: string; seed: number } | null;
	teamB: { id: string; name: string; seed: number } | null;
	bye: boolean;
};

export function previewFirstRoundPairs(teams: PreviewTeam[]): PreviewPair[] {
	if (teams.length < 2) return [];
	const sorted = [...teams].sort((a, b) => a.seed - b.seed || a.name.localeCompare(b.name, 'ru'));
	const size = nextPowerOfTwo(sorted.length);
	const order = seedOrder(size);
	const slots = order.map((seed) => sorted[seed - 1] ?? null);
	const pairs: PreviewPair[] = [];
	for (let pos = 0; pos < size / 2; pos++) {
		const a = slots[pos * 2];
		const b = slots[pos * 2 + 1];
		pairs.push({
			position: pos,
			teamA: a ? { id: a.teamId, name: a.name, seed: a.seed } : null,
			teamB: b ? { id: b.teamId, name: b.name, seed: b.seed } : null,
			bye: Boolean((a && !b) || (!a && b))
		});
	}
	return pairs;
}
