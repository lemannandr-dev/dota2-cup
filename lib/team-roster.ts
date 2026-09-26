import { rankMedalFromTier, storedOpenDotaMmr, type HeaderRankMedal, type OpenDotaMmr } from '@/lib/dota-rank';
import { playerCardHref } from '@/lib/site';

export type RosterLockApp = { status: string };

export type RosterSlotPlayer = {
	id: string;
	displayName: string;
	avatarUrl: string | null;
	href: string;
	steamId?: string | null;
	medal: HeaderRankMedal | null;
	mmr: OpenDotaMmr | null;
	hasSteam: boolean;
};

export function mapRosterSlotPlayers(
	members: Array<{
		confirmed?: boolean;
		isSubstitute?: boolean;
		user: {
			id: string;
			displayName: string;
			avatarUrl?: string | null;
			steamId?: string | null;
			openDotaRankTier?: number | null;
			openDotaLeaderboard?: number | null;
			openDotaMmr?: number | null;
			openDotaMmrSource?: string | null;
		};
	}>
): RosterSlotPlayer[] {
	return members
		.filter((member) => member.confirmed && !member.isSubstitute)
		.slice(0, 5)
		.map((member) => ({
			id: member.user.id,
			displayName: member.user.displayName,
			avatarUrl: member.user.avatarUrl ?? null,
			href: playerCardHref(member.user.id),
			steamId: member.user.steamId ?? null,
			medal: rankMedalFromTier(member.user.openDotaRankTier, member.user.openDotaLeaderboard),
			mmr: storedOpenDotaMmr(member.user.openDotaMmr, member.user.openDotaMmrSource),
			hasSteam: Boolean(member.user.steamId)
		}));
}

export function teamRosterLocked(applications: RosterLockApp[]) {
	return applications.some((app) => ['CHECKED_IN', 'IN_BRACKET'].includes(app.status));
}

export function canLeaveTeam(input: { userId: string; createdById: string; locked: boolean }) {
	if (input.locked) return false;
	return input.userId !== input.createdById;
}

export function canKickTeamMember(input: { actorId: string; createdById: string; targetUserId: string; actorIsCaptain: boolean; locked: boolean }) {
	if (input.locked) return false;
	if (input.targetUserId === input.createdById) return false;
	return input.actorId === input.createdById || input.actorIsCaptain;
}

export function canMarkSubstitute(input: { actorId: string; createdById: string; actorIsCaptain: boolean; locked: boolean }) {
	if (input.locked) return false;
	return input.actorId === input.createdById || input.actorIsCaptain;
}

export type MainRosterCount = {
	confirmed: number;
	withSteam: number;
	needed: number;
	full: boolean;
	ready: boolean;
};

export function countMainRoster(
	members: Array<{ confirmed?: boolean; isSubstitute?: boolean; steamId?: string | null; user?: { steamId?: string | null } }>
): MainRosterCount {
	const mains = members.filter((member) => member.confirmed && !member.isSubstitute);
	const withSteam = mains.filter((member) => Boolean(member.steamId || member.user?.steamId)).length;
	return {
		confirmed: mains.length,
		withSteam,
		needed: Math.max(0, 5 - withSteam),
		full: mains.length >= 5,
		ready: mains.length === 5 && withSteam === 5
	};
}

export function inviteRosterBlock(roster: MainRosterCount) {
	if (roster.ready) return 'Состав уже 5/5 Steam. Шестого звать некуда.';
	if (roster.full) return 'В пятёрке уже 5 человек, но не у всех Steam. Замените игрока, не зовите шестого.';
	return null;
}

export function cupTitleFromInviteMessage(message?: string | null) {
	const match = message?.match(/Кубок:\s*(.+)$/m);
	return match?.[1]?.trim() || null;
}

export function inviteAcceptCopy(roster: MainRosterCount, cupTitle?: string | null) {
	if (roster.ready) {
		return cupTitle
			? `Вы в пятёрке Steam. Капитан может заявить команду на ${cupTitle}.`
			: 'Вы в пятёрке Steam. Дальше капитан заявляет команду на кубок.';
	}
	const cup = cupTitle ? ` Кубок: ${cupTitle}.` : '';
	return `Вы в составе. Сейчас ${roster.withSteam} из 5 Steam, ещё ${roster.needed}.${cup}`;
}

export function partySearchHref(input: {
	teamId?: string | null;
	tournamentId?: string | null;
	invite?: string | null;
	tab?: 'players' | 'lfg';
	q?: string | null;
	playerId?: string | null;
}) {
	const params = new URLSearchParams();
	params.set('tab', input.tab ?? 'players');
	if (input.teamId) params.set('teamId', input.teamId);
	if (input.tournamentId) params.set('tournamentId', input.tournamentId);
	if (input.invite) params.set('invite', input.invite);
	if (input.q?.trim()) params.set('q', input.q.trim());
	if (input.playerId) params.set('playerId', input.playerId);
	return `/party-search?${params.toString()}`;
}
