import { describe, expect, it } from 'vitest';
import { adminUserCounts, adminUserOnArena, filterAdminUsers, type AdminUserRow } from '@/lib/admin-users-list';

const now = Date.parse('2026-09-22T12:00:00.000Z');

const rows: AdminUserRow[] = [
	{
		id: 'owner',
		userId: '1',
		displayName: 'o555aa',
		steamId: '76561198835548729',
		role: 'ADMIN',
		balance: 0,
		totpEnabledAt: '2026-01-01T00:00:00.000Z',
		lastLoginAt: '2026-09-22T11:50:00.000Z'
	},
	{
		id: 'org',
		displayName: 'Капитан',
		username: 'cap',
		role: 'ORGANIZER',
		steamId: null,
		balance: 150000,
		totpEnabledAt: null
	},
	{
		id: 'hotel',
		displayName: 'Hotel-hard',
		email: 'hotel@example.com',
		role: 'USER',
		steamId: '76561199550000039',
		balance: 0,
		totpEnabledAt: null
	}
];

describe('admin user list', () => {
	it('filters by steam, key, staff and a non-zero wallet', () => {
		expect(filterAdminUsers(rows, 'steam').map((row) => row.id)).toEqual(['owner', 'hotel']);
		expect(filterAdminUsers(rows, 'nosteam').map((row) => row.id)).toEqual(['org']);
		expect(filterAdminUsers(rows, 'nokey').map((row) => row.id)).toEqual(['org', 'hotel']);
		expect(filterAdminUsers(rows, 'staff').map((row) => row.id)).toEqual(['owner', 'org']);
		expect(filterAdminUsers(rows, 'balance').map((row) => row.id)).toEqual(['org']);
	});

	it('searches name, steam, mail and id together with the chip', () => {
		expect(filterAdminUsers(rows, 'nokey', 'hotel').map((row) => row.id)).toEqual(['hotel']);
		expect(filterAdminUsers(rows, 'all', '76561198835548729').map((row) => row.id)).toEqual(['owner']);
		expect(filterAdminUsers(rows, 'all', 'hotel@example.com')).toHaveLength(1);
		expect(filterAdminUsers(rows, 'steam', 'капитан')).toHaveLength(0);
	});

	it('counts the current search, not the hidden chip', () => {
		expect(adminUserCounts(filterAdminUsers(rows, 'all', 'hotel'))).toEqual({
			all: 1,
			steam: 1,
			nosteam: 0,
			nokey: 1,
			staff: 0,
			balance: 0
		});
	});

	it('marks a login inside 15 minutes as on the arena', () => {
		expect(adminUserOnArena('2026-09-22T11:50:00.000Z', now)).toBe(true);
		expect(adminUserOnArena('2026-09-22T11:40:00.000Z', now)).toBe(false);
		expect(adminUserOnArena(null, now)).toBe(false);
	});
});
