export type FriendBond = {
	requesterId: string;
	addresseeId: string;
	status: string;
};

export type FriendView = 'self' | 'friends' | 'outgoing' | 'incoming' | 'none';

export function friendView(bonds: FriendBond[], me: string, them: string): FriendView {
	if (me === them) return 'self';
	const row = bonds.find(
		(bond) =>
			(bond.requesterId === me && bond.addresseeId === them) ||
			(bond.requesterId === them && bond.addresseeId === me)
	);
	if (!row || row.status === 'DECLINED') return 'none';
	if (row.status === 'ACCEPTED') return 'friends';
	return row.requesterId === me ? 'outgoing' : 'incoming';
}

export function bondSets(bonds: FriendBond[], me: string) {
	const friends: string[] = [];
	const outgoing: string[] = [];
	const incoming: string[] = [];
	for (const bond of bonds) {
		const them = bond.requesterId === me ? bond.addresseeId : bond.requesterId;
		const view = friendView([bond], me, them);
		if (view === 'friends') friends.push(them);
		if (view === 'outgoing') outgoing.push(them);
		if (view === 'incoming') incoming.push(them);
	}
	return { friends, outgoing, incoming };
}
