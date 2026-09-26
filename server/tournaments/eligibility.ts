import { DomainError } from '@/server/errors';

export type RosterMember = {
	userId: string;
	isSubstitute: boolean;
	confirmed: boolean;
	user: { id: string; steamId: string | null; displayName: string };
};

export type RosterSnapshot = {
	userId: string;
	steamId: string | null;
	displayName: string;
};

export function assertEligibleRoster(members: RosterMember[]): {
	userIds: string[];
	steamIds: string[];
	snapshot: RosterSnapshot[];
} {
	const mainRoster = members.filter((m) => !m.isSubstitute && m.confirmed);
	if (mainRoster.length !== 5) {
		throw new DomainError(`Нужно ровно 5 подтверждённых основных игроков, сейчас ${mainRoster.length}`, 400);
	}
	const steamIds = mainRoster.map((m) => m.user.steamId).filter((id): id is string => Boolean(id));
	if (steamIds.length !== 5 || new Set(steamIds).size !== 5) {
		throw new DomainError('Все 5 игроков должны иметь уникальные подтверждённые Steam-аккаунты', 400);
	}
	return {
		userIds: mainRoster.map((m) => m.userId),
		steamIds,
		snapshot: mainRoster.map((m) => ({
			userId: m.userId,
			steamId: m.user.steamId,
			displayName: m.user.displayName
		}))
	};
}
