import { describe, expect, it } from 'vitest';
import { assertEligibleRoster } from '../server/tournaments/eligibility';
import { DomainError } from '../server/errors';

function member(id: string, steamId: string | null, confirmed = true) {
	return {
		userId: id,
		isSubstitute: false,
		confirmed,
		user: { id, steamId, displayName: id }
	};
}

describe('roster eligibility', () => {
	it('requires exactly five confirmed mains', () => {
		expect(() => assertEligibleRoster([member('1', '1'), member('2', '2')])).toThrow(DomainError);
	});

	it('requires unique steam accounts', () => {
		const roster = [
			member('1', 's1'),
			member('2', 's2'),
			member('3', 's3'),
			member('4', 's4'),
			member('5', null)
		];
		expect(() => assertEligibleRoster(roster)).toThrow(/Steam/);
	});

	it('accepts a valid five-stack', () => {
		const roster = [1, 2, 3, 4, 5].map((n) => member(String(n), `steam${n}`));
		const result = assertEligibleRoster(roster);
		expect(result.steamIds).toHaveLength(5);
		expect(result.snapshot).toHaveLength(5);
	});
});
