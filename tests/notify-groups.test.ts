import { describe, expect, it } from 'vitest';
import { groupNotifications, notifyGroupOf } from '@/lib/notify-groups';

describe('notify groups', () => {
	it('buckets match and invite types', () => {
		expect(notifyGroupOf('TEAM_INVITE')).toBe('invite');
		expect(notifyGroupOf('FRIEND_REQUEST')).toBe('invite');
		expect(notifyGroupOf('LOBBY_MENTION')).toBe('other');
		expect(notifyGroupOf('MATCH_SOON')).toBe('lobby');
		expect(notifyGroupOf('PAIR_SOON')).toBe('lobby');
		expect(notifyGroupOf('MATCH_DISPUTE')).toBe('dispute');
		expect(notifyGroupOf('APPLICATION_REVIEW')).toBe('check_in');
		expect(notifyGroupOf('TOURNAMENT_REMIND_CHECK_IN')).toBe('check_in');
		expect(notifyGroupOf('TOURNAMENT_NO_CHECK_IN')).toBe('check_in');
		const groups = groupNotifications([
			{ type: 'TEAM_INVITE', id: '1' },
			{ type: 'MATCH_REPORT', id: '2' },
			{ type: 'MATCH_DISPUTE', id: '3' }
		]);
		expect(groups.map((row) => row.id)).toEqual(['dispute', 'score', 'invite']);
		expect(groups[0].items).toHaveLength(1);
	});
});
