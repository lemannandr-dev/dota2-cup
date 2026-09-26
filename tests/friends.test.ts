import { describe, expect, it } from 'vitest';
import { bondSets, friendView } from '@/lib/friends';

const me = 'me';
const them = 'them';

describe('friend bonds', () => {
	it('reads the bond from either side and ignores a decline', () => {
		expect(friendView([], me, me)).toBe('self');
		expect(friendView([], me, them)).toBe('none');
		expect(friendView([{ requesterId: me, addresseeId: them, status: 'PENDING' }], me, them)).toBe('outgoing');
		expect(friendView([{ requesterId: them, addresseeId: me, status: 'PENDING' }], me, them)).toBe('incoming');
		expect(friendView([{ requesterId: me, addresseeId: them, status: 'ACCEPTED' }], me, them)).toBe('friends');
		expect(friendView([{ requesterId: them, addresseeId: me, status: 'DECLINED' }], me, them)).toBe('none');
	});

	it('splits a list into friends, outgoing and incoming', () => {
		expect(
			bondSets(
				[
					{ requesterId: me, addresseeId: 'a', status: 'ACCEPTED' },
					{ requesterId: me, addresseeId: 'b', status: 'PENDING' },
					{ requesterId: 'c', addresseeId: me, status: 'PENDING' }
				],
				me
			)
		).toEqual({ friends: ['a'], outgoing: ['b'], incoming: ['c'] });
	});
});
