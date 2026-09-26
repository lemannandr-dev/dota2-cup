export type NotifyGroupId = 'invite' | 'check_in' | 'lobby' | 'score' | 'dispute' | 'other';

export const notifyGroupLabel: Record<NotifyGroupId, string> = {
	invite: 'Приглашения',
	check_in: 'Чек-ин и готовность',
	lobby: 'Лобби',
	score: 'Счёт',
	dispute: 'Споры',
	other: 'Прочее'
};

const GROUP_ORDER: NotifyGroupId[] = ['dispute', 'score', 'lobby', 'check_in', 'invite', 'other'];

export function notifyGroupOf(type: string): NotifyGroupId {
	if (type === 'TEAM_INVITE' || type === 'TEAM_INVITE_RESPONSE' || type === 'FRIEND_REQUEST' || type === 'FRIEND_ACCEPTED') return 'invite';
	if (
		type === 'TOURNAMENT_CHECK_IN' ||
		type === 'TOURNAMENT_READY' ||
		type === 'TOURNAMENT_NO_CHECK_IN' ||
		type === 'APPLICATION_REVIEW' ||
		type === 'TOURNAMENT_REMIND_CHECK_IN' ||
		type === 'TOURNAMENT_REMIND_READY' ||
		type === 'TOURNAMENT_REMIND_NEEDS_ACTION' ||
		type === 'TOURNAMENT_REMIND_START'
	) {
		return 'check_in';
	}
	if (type === 'MATCH_LOBBY' || type === 'MATCH_SOON' || type === 'PAIR_SOON') return 'lobby';
	if (type === 'MATCH_REPORT' || type === 'MATCH_RESULT') return 'score';
	if (type === 'MATCH_DISPUTE' || type === 'STAFF_ASSIGNED' || type === 'REFEREE_NOMINATED') return 'dispute';
	if (type === 'ADMIN_TOPUP_REQUEST' || type === 'LOBBY_MENTION') return 'other';
	return 'other';
}

export function groupNotifications<T extends { type: string }>(items: T[]) {
	const buckets = new Map<NotifyGroupId, T[]>();
	for (const item of items) {
		const group = notifyGroupOf(item.type);
		const list = buckets.get(group) ?? [];
		list.push(item);
		buckets.set(group, list);
	}
	return GROUP_ORDER.filter((id) => (buckets.get(id)?.length ?? 0) > 0).map((id) => ({
		id,
		label: notifyGroupLabel[id],
		items: buckets.get(id) ?? []
	}));
}
