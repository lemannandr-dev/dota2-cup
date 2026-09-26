import { describe, expect, it } from 'vitest';
import { canJoinWaitlist, canPromoteWaitlist, countedApplicationStatus } from '@/lib/waitlist';

describe('waitlist', () => {
	it('joins when the cup is full and promotes only into a free slot', () => {
		expect(countedApplicationStatus('WAITLIST')).toBe(false);
		expect(canJoinWaitlist({ counted: 8, maxTeams: 8, tournamentStatus: 'REGISTRATION' })).toBe(true);
		expect(canPromoteWaitlist({ counted: 7, maxTeams: 8, applicationStatus: 'WAITLIST', tournamentStatus: 'REGISTRATION' })).toBe(true);
		expect(canPromoteWaitlist({ counted: 8, maxTeams: 8, applicationStatus: 'WAITLIST', tournamentStatus: 'REGISTRATION' })).toBe(false);
	});
});
