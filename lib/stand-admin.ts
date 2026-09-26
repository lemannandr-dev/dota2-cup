export const STAND_ADMIN_ID = 'cmt397c1e00001536lgemhbrw';
export const STAND_ADMIN_STEAM = '76561198835548729';

export function isStandAdmin(user: { id?: string | null; steamId?: string | null } | null | undefined) {
	if (!user) return false;
	return user.id === STAND_ADMIN_ID || user.steamId === STAND_ADMIN_STEAM;
}

export function canAssignStandRole(input: { actorId: string; targetId: string; nextRole: string }) {
	if (!isStandAdmin({ id: input.actorId })) return false;
	if (input.nextRole === 'ADMIN' && input.targetId !== STAND_ADMIN_ID) return false;
	if (input.targetId === STAND_ADMIN_ID && input.nextRole !== 'ADMIN') return false;
	return true;
}

export function canDeleteStandUser(input: { actorId: string; targetId: string }) {
	if (!isStandAdmin({ id: input.actorId })) return false;
	if (input.targetId === STAND_ADMIN_ID) return false;
	if (input.actorId === input.targetId) return false;
	return true;
}
