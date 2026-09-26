import { describe, expect, it } from 'vitest';
import { adminMatchGaps, adminMatchSeries, type AdminMatchInput } from '@/lib/admin-matches';

const now = new Date('2026-09-22T12:00:00.000Z');

function match(patch: Partial<AdminMatchInput> = {}): AdminMatchInput {
	return {
		status: 'SCHEDULED',
		scoreA: 0,
		scoreB: 0,
		bestOf: 3,
		hasTeamA: true,
		hasTeamB: true,
		hasWinner: false,
		dotaMatchCount: 0,
		reportDeadlineAt: '2026-09-22T18:00:00.000Z',
		openDisputeStatuses: [],
		...patch
	};
}

describe('admin match gaps', () => {
	it('stays quiet for a scheduled pair with both sides and a future deadline', () => {
		expect(adminMatchGaps(match(), now)).toEqual([]);
	});

	it('flags a missing side, an overdue report and an open dispute', () => {
		expect(adminMatchGaps(match({ status: 'LIVE', hasTeamB: false }), now).map((gap) => gap.id)).toEqual(['opponent']);
		expect(adminMatchGaps(match({ reportDeadlineAt: '2026-09-22T08:00:00.000Z' }), now).map((gap) => gap.label)).toEqual(['Просрочен репорт']);
		expect(adminMatchGaps(match({ openDisputeStatuses: ['IN_REVIEW'] }), now)[0]).toMatchObject({ id: 'dispute', label: 'На разборе', tone: 'alert' });
	});

	it('asks a closed pair for a winner and a Dota id', () => {
		const gaps = adminMatchGaps(match({ status: 'COMPLETED', scoreA: 1, scoreB: 0, hasWinner: false, dotaMatchCount: 0 }), now);
		expect(gaps.map((gap) => gap.id)).toEqual(['winner', 'dota']);
	});

	it('does not call an empty pending slot a hole', () => {
		expect(adminMatchGaps(match({ status: 'PENDING', hasTeamA: false, hasTeamB: false, reportDeadlineAt: null }), now)).toEqual([]);
		expect(adminMatchGaps(match({ status: 'PENDING', hasTeamB: false, reportDeadlineAt: null }), now).map((gap) => gap.tone)).toEqual(['soft']);
	});

	it('reads how many games of the series are played', () => {
		expect(adminMatchSeries(2, 1, 3)).toMatchObject({ played: 3, cap: 3, decided: true, ratio: 1 });
		expect(adminMatchSeries(0, 0, 1).decided).toBe(false);
	});
});