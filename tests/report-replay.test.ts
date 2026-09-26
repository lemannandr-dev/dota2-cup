import { describe, expect, it } from 'vitest';
import { matchingTeamReport, shouldReplayOpenDispute, shouldReplaySettledReport } from '@/lib/report-replay';
import { readIdempotencyKey } from '@/server/http/mutation-guards';

describe('report replay after network loss', () => {
	const reports = [
		{ teamId: 'a', scoreA: 2, scoreB: 0 },
		{ teamId: 'b', scoreA: 2, scoreB: 0 }
	];

	it('matches the team score row', () => {
		expect(matchingTeamReport(reports, 'a', 2, 0)).toBe(true);
		expect(matchingTeamReport(reports, 'a', 1, 0)).toBe(false);
	});

	it('replays a settled match with the same captain score', () => {
		expect(shouldReplaySettledReport('COMPLETED', reports, 'a', 2, 0)).toBe(true);
		expect(shouldReplaySettledReport('TECHNICAL', reports, 'b', 2, 0)).toBe(true);
		expect(shouldReplaySettledReport('COMPLETED', reports, 'a', 1, 0)).toBe(false);
		expect(shouldReplaySettledReport('SCHEDULED', reports, 'a', 2, 0)).toBe(false);
	});

	it('replays an open dispute without opening a second row', () => {
		const disputed = [
			{ teamId: 'a', scoreA: 2, scoreB: 0 },
			{ teamId: 'b', scoreA: 0, scoreB: 2 }
		];
		expect(shouldReplayOpenDispute('NEEDS_REVIEW', disputed, 'a', 2, 0)).toBe(true);
		expect(shouldReplayOpenDispute('NEEDS_REVIEW', disputed, 'a', 0, 2)).toBe(false);
		expect(shouldReplayOpenDispute('SCHEDULED', disputed, 'a', 2, 0)).toBe(false);
	});
});

describe('Idempotency-Key header', () => {
	it('accepts uuid-like keys and rejects short junk', () => {
		expect(readIdempotencyKey(new Request('http://localhost:3002', { headers: { 'idempotency-key': 'report-abc-12345' } }))).toBe(
			'report-abc-12345'
		);
		expect(readIdempotencyKey(new Request('http://localhost:3002', { headers: { 'idempotency-key': 'bad' } }))).toBeNull();
		expect(readIdempotencyKey(new Request('http://localhost:3002'))).toBeNull();
	});
});
