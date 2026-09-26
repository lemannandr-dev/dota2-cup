import { describe, expect, it } from 'vitest';
import { summarizeCheckIn } from '@/lib/check-in-desk';

describe('check-in desk', () => {
	it('counts present, silent and dropped stacks', () => {
		const desk = summarizeCheckIn([
			{ id: '1', status: 'CHECKED_IN', team: { name: 'Iskry' } },
			{ id: '2', status: 'APPROVED', team: { name: 'Mолчуны' } },
			{ id: '3', status: 'NO_CHECK_IN', team: { name: 'Late' } }
		]);
		expect(desk).toMatchObject({ present: 1, silent: 1, dropped: 1 });
		expect(desk.silentTeams[0]?.name).toBe('Mолчуны');
	});
});
