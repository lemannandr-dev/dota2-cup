import { describe, expect, it } from 'vitest';
import {
	STAND_ADMIN_ID,
	canAssignStandRole,
	canDeleteStandUser,
	isStandAdmin
} from '@/lib/stand-admin';

describe('stand admin pin', () => {
	it('recognizes only o555aa', () => {
		expect(isStandAdmin({ id: STAND_ADMIN_ID, steamId: '76561198835548729' })).toBe(true);
		expect(isStandAdmin({ id: 'other', steamId: '76561198000000001' })).toBe(false);
		expect(isStandAdmin(null)).toBe(false);
	});

	it('does not grant ADMIN to anyone else and does not demote the stand owner', () => {
		expect(canAssignStandRole({ actorId: STAND_ADMIN_ID, targetId: STAND_ADMIN_ID, nextRole: 'ADMIN' })).toBe(true);
		expect(canAssignStandRole({ actorId: STAND_ADMIN_ID, targetId: 'other', nextRole: 'ORGANIZER' })).toBe(true);
		expect(canAssignStandRole({ actorId: STAND_ADMIN_ID, targetId: 'other', nextRole: 'ADMIN' })).toBe(false);
		expect(canAssignStandRole({ actorId: STAND_ADMIN_ID, targetId: STAND_ADMIN_ID, nextRole: 'USER' })).toBe(false);
		expect(canAssignStandRole({ actorId: 'other', targetId: 'other', nextRole: 'ADMIN' })).toBe(false);
	});

	it('does not delete the stand owner', () => {
		expect(canDeleteStandUser({ actorId: STAND_ADMIN_ID, targetId: 'other' })).toBe(true);
		expect(canDeleteStandUser({ actorId: STAND_ADMIN_ID, targetId: STAND_ADMIN_ID })).toBe(false);
	});
});
