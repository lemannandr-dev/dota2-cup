import { applicationStatusLabel, tournamentStatusLabel } from '@/lib/tournament-copy';

export type TeamCupSource = {
	tournamentId: string;
	title: string;
	status: string;
	applicationStatus: string;
};

export type TeamMatchSource = {
	tournamentId: string;
	teamAId: string | null;
	teamBId: string | null;
	scoreA: number;
	scoreB: number;
	status: string;
	winnerTeamId: string | null;
	nextMatchId: string | null;
};

export type TeamCupRecord = {
	id: string;
	title: string;
	href: string;
	statusLabel: string;
	result: string;
};

export type TeamRecord = {
	wins: number;
	losses: number;
	winRate: number | null;
	cups: TeamCupRecord[];
};

function played(match: TeamMatchSource, teamId: string) {
	return match.teamAId === teamId || match.teamBId === teamId;
}

function decided(match: TeamMatchSource) {
	return (match.status === 'COMPLETED' || match.status === 'TECHNICAL') && Boolean(match.winnerTeamId);
}

function scoreLine(match: TeamMatchSource, teamId: string) {
	const mine = match.teamAId === teamId ? match.scoreA : match.scoreB;
	const theirs = match.teamAId === teamId ? match.scoreB : match.scoreA;
	return `${mine}:${theirs}`;
}

function cupResult(teamId: string, cupStatus: string, applicationStatus: string, matches: TeamMatchSource[]) {
	const closed = matches.filter(decided);
	const finalWin = closed.find((match) => match.winnerTeamId === teamId && !match.nextMatchId);
	if (finalWin && cupStatus === 'FINISHED') return `чемпион · ${scoreLine(finalWin, teamId)}`;
	if (finalWin) return `победа · ${scoreLine(finalWin, teamId)}`;
	const loss = closed.find((match) => match.winnerTeamId !== teamId);
	if (loss) return `вылет · ${scoreLine(loss, teamId)}`;
	if (matches.some((match) => match.status === 'LIVE' || match.status === 'SCHEDULED' || match.status === 'NEEDS_REVIEW')) {
		return 'в сетке';
	}
	return applicationStatusLabel(applicationStatus);
}

export function buildTeamRecord(teamId: string, cups: TeamCupSource[], matches: TeamMatchSource[]): TeamRecord {
	const own = matches.filter((match) => played(match, teamId));
	const closed = own.filter(decided);
	const wins = closed.filter((match) => match.winnerTeamId === teamId).length;
	const losses = closed.length - wins;
	const seen = new Set<string>();
	const history = cups.flatMap((cup) => {
		if (seen.has(cup.tournamentId)) return [];
		seen.add(cup.tournamentId);
		const cupMatches = own.filter((match) => match.tournamentId === cup.tournamentId);
		return [{
			id: cup.tournamentId,
			title: cup.title,
			href: `/tournaments/${cup.tournamentId}`,
			statusLabel: tournamentStatusLabel(cup.status),
			result: cupResult(teamId, cup.status, cup.applicationStatus, cupMatches)
		}];
	});
	return {
		wins,
		losses,
		winRate: closed.length > 0 ? Math.round((wins / closed.length) * 100) : null,
		cups: history
	};
}
