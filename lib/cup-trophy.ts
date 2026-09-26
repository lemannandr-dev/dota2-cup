import { pickFinalMatch, placeTeamsFromFinal } from '@/lib/prize-places';
import { rosterFromSnapshot } from '@/lib/match-day';
import { prizeHonestyHint, publicPrizeCaption, type LandingPrizeKind } from '@/lib/landing-live';
import { parseBroadcast } from '@/lib/broadcast';
import { buildCupHighlights, type CupHighlight } from '@/lib/cup-highlights';
import { teamDeskHref } from '@/lib/site';
import { aegisAwardOf, parseAegisAward, type AegisAwardDef } from '@/lib/aegis-awards';

export type CupTrophyPlayer = {
	userId?: string;
	displayName: string;
	steamNick: string;
	steamId?: string | null;
};

export type CupStoryTeam = {
	id: string;
	name: string;
	place: 1 | 2;
	href: string;
	players: CupTrophyPlayer[];
};

export type CupTrophyView = {
	tournamentId?: string;
	href?: string;
	year: number;
	title: string;
	engraving: string;
	winnerTeamId: string;
	winnerTeamName: string;
	description: string;
	players: CupTrophyPlayer[];
	prizeLabel: string;
	prizeKind: LandingPrizeKind;
	prizeHint: string | null;
	finalScore: string | null;
	runnerUpTeamName: string | null;
	teams: CupStoryTeam[];
	highlights: CupHighlight[];
	award: AegisAwardDef;
};

export function trophyYearFromStart(startAt: Date | string | null | undefined) {
	if (!startAt) return new Date().getUTCFullYear();
	const iso = startAt instanceof Date ? startAt.toISOString() : startAt;
	const year = Number(iso.slice(0, 4));
	return Number.isFinite(year) ? year : new Date().getUTCFullYear();
}

type TrophyApplication = {
	teamId: string;
	rosterSnapshot?: unknown;
	team?: {
		id: string;
		name: string;
		members?: Array<{ userId?: string; user: { id?: string; displayName: string; steamId?: string | null } }>;
	};
};

function rosterFromApplication(application?: TrophyApplication): CupTrophyPlayer[] {
	const fromSnapshot = rosterFromSnapshot(application?.rosterSnapshot).map((row) => ({
		userId: row.userId,
		displayName: row.displayName,
		steamNick: row.displayName,
		steamId: row.steamId ?? null
	}));
	if (fromSnapshot.length) return fromSnapshot;
	return (application?.team?.members ?? []).map((member) => ({
		userId: member.userId ?? member.user.id,
		displayName: member.user.displayName,
		steamNick: member.user.displayName,
		steamId: member.user.steamId ?? null
	}));
}

export function buildCupTrophy(input: {
	tournamentId?: string;
	title: string;
	startAt?: Date | string | null;
	prizePool?: number;
	prizeStatus?: string;
	prizeCurrency?: string;
	broadcast?: unknown;
	aegisAward?: string | null;
	matches: Array<{
		bracket: string;
		winnerTeamId: string | null;
		teamAId: string | null;
		teamBId: string | null;
		scoreA?: number;
		scoreB?: number;
		nextMatchId?: string | null;
		teamA?: { id: string; name: string } | null;
		teamB?: { id: string; name: string } | null;
	}>;
	applications: TrophyApplication[];
}): CupTrophyView | null {
	const finalMatch = pickFinalMatch(input.matches);
	if (!finalMatch?.winnerTeamId) return null;
	const winner =
		finalMatch.teamA?.id === finalMatch.winnerTeamId
			? finalMatch.teamA
			: finalMatch.teamB?.id === finalMatch.winnerTeamId
				? finalMatch.teamB
				: input.applications.find((app) => app.teamId === finalMatch.winnerTeamId)?.team;
	if (!winner?.name) return null;
	const places = placeTeamsFromFinal(finalMatch);
	const winnerApp = input.applications.find((app) => app.teamId === finalMatch.winnerTeamId);
	const runnerApp = places[2] ? input.applications.find((app) => app.teamId === places[2]) : undefined;
	const runner =
		finalMatch.teamA?.id === places[2]
			? finalMatch.teamA
			: finalMatch.teamB?.id === places[2]
				? finalMatch.teamB
				: runnerApp?.team;
	const players = rosterFromApplication(winnerApp);
	const runnerPlayers = rosterFromApplication(runnerApp);
	const nicks = players.map((player) => player.steamNick).filter(Boolean);
	const prizePool = input.prizePool ?? 0;
	const prizeStatus = input.prizeStatus ?? (prizePool > 0 ? 'UNCONFIRMED' : 'NONE');
	const prizeCaption = publicPrizeCaption(prizeStatus, prizePool, input.prizeCurrency ?? 'RUB');
	const prizeKind = prizeCaption.kind;
	const prizeLabel = prizeCaption.label;
	const desk = parseBroadcast(input.broadcast);
	const hasScore = typeof finalMatch.scoreA === 'number' && typeof finalMatch.scoreB === 'number';
	return {
		tournamentId: input.tournamentId,
		href: input.tournamentId ? `/tournaments/${input.tournamentId}/cup` : undefined,
		year: trophyYearFromStart(input.startAt),
		title: input.title,
		engraving: winner.name,
		winnerTeamId: finalMatch.winnerTeamId,
		winnerTeamName: winner.name,
		description: nicks.length
			? `Чемпионы «${winner.name}»: ${nicks.join(', ')}`
			: `Чемпионы «${winner.name}». Состав на момент финала не записан.`,
		players,
		prizeLabel,
		prizeKind,
		prizeHint: prizeHonestyHint(prizeStatus, prizePool),
		finalScore: hasScore ? `${finalMatch.scoreA}:${finalMatch.scoreB}` : null,
		runnerUpTeamName: runner?.name ?? null,
		teams: [
			{ id: finalMatch.winnerTeamId, name: winner.name, place: 1 as const, href: teamDeskHref(finalMatch.winnerTeamId), players },
			...(places[2] && runner?.name
				? [{ id: places[2], name: runner.name, place: 2 as const, href: teamDeskHref(places[2]), players: runnerPlayers }]
				: [])
		],
		highlights: buildCupHighlights({
			urls: desk.highlights,
			youtubeUrl: desk.youtubeUrl,
			youtubeSecondaryUrl: desk.youtubeSecondaryUrl
		}),
		award: aegisAwardOf(parseAegisAward(input.aegisAward))
	};
}
