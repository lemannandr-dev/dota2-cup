import { winsNeeded } from '@/lib/bracket-pure';

export type NoShowSide = 'A' | 'B';

export function noShowSeriesScore(bestOf: number, absent: NoShowSide) {
	const need = winsNeeded(bestOf);
	return absent === 'A' ? { scoreA: 0, scoreB: need } : { scoreA: need, scoreB: 0 };
}
