import { describe, expect, it } from 'vitest';
import { canActForTeam, deputyIdFromMembers, invitePositionLabel, rosterBadge } from '@/lib/team-roles';

describe('team roles', () => {
	it('finds one deputy and badges the captain', () => {
		expect(
			deputyIdFromMembers(
				[
					{ userId: 'cap', role: 'captain', confirmed: true },
					{ userId: 'dep', role: 'deputy', confirmed: true }
				],
				'cap'
			)
		).toBe('dep');
		expect(rosterBadge('cap', 'cap', 'dep')).toBe('captain');
		expect(rosterBadge('dep', 'cap', 'dep')).toBe('deputy');
		expect(canActForTeam('dep', 'cap', 'dep')).toBe(true);
		expect(invitePositionLabel(4)).toContain('поддержка');
	});
});
