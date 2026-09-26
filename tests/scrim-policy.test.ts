import { describe, expect, it } from 'vitest';
import { arenaRatingFromResults } from '@/lib/arena-rating';
import { scrimChallengeRejected, scrimPaysPrize, scrimRatingAfterClose, scrimReportIsReplay } from '@/lib/scrim-policy';

describe('scrim policy', () => {
	it('rejects a second challenge while an invite or an open pair exists', () => {
		expect(scrimChallengeRejected([{ status: 'PENDING' }])).toBe(true);
		expect(scrimChallengeRejected([{ status: 'ACCEPTED', matchStatus: 'SCHEDULED' }])).toBe(true);
		expect(scrimChallengeRejected([{ status: 'ACCEPTED', matchStatus: 'NEEDS_REVIEW' }])).toBe(true);
		expect(scrimChallengeRejected([{ status: 'ACCEPTED', matchStatus: 'COMPLETED' }])).toBe(false);
		expect(scrimChallengeRejected([{ status: 'DECLINED' }])).toBe(false);
		expect(scrimChallengeRejected([])).toBe(false);
	});

	it('does not pay a prize and does not double the arena delta on a replayed report', () => {
		expect(scrimPaysPrize()).toBe(false);
		const first = scrimRatingAfterClose({ matchId: 'm1', won: true, replayed: false });
		expect(first).toEqual({ matchId: 'm1', delta: 16, games: 1 });
		expect(scrimRatingAfterClose({ matchId: 'm1', won: true, replayed: true })).toBeNull();
		expect(arenaRatingFromResults([{ won: true }]).rating).toBe(1016);
		expect(
			scrimReportIsReplay('COMPLETED', [{ teamId: 'a', scoreA: 1, scoreB: 0 }], 'a', 1, 0)
		).toBe(true);
		expect(
			scrimReportIsReplay('COMPLETED', [{ teamId: 'a', scoreA: 1, scoreB: 0 }], 'a', 0, 1)
		).toBe(false);
	});
});
