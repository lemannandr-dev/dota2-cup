import { prisma } from '@/lib/prisma';
import { DomainError } from '@/server/errors';
import { ensureOwnerStaff } from '@/server/tournaments/staff';
import type { Role, TournamentFormat } from '@prisma/client';
import { withStreamRule } from '@/lib/twitch';
import { broadcastFromInput } from '@/lib/broadcast';
import { parseAegisAward, suggestAegisAward } from '@/lib/aegis-awards';

export type CreateTournamentInput = {
	title: string;
	description?: string;
	format?: TournamentFormat;
	maxTeams?: 8 | 16 | 32;
	seriesRules?: string;
	region?: string;
	rankCap?: string;
	prizePool?: number;
	startAt: Date;
	checkInOpensAt?: Date | null;
	checkInClosesAt?: Date | null;
	rules?: string;
	twitchChannel?: string;
	twitchSecondary?: string;
	youtubeUrl?: string;
	youtubeSecondaryUrl?: string;
	dotaTv?: string;
	lobbyName?: string;
	delaySec?: number;
	overlayTitle?: string;
	aegisAward?: string;
	inviteOnly?: boolean;
};

export async function createTournamentDraft(userId: string, _role: Role, input: CreateTournamentInput) {
	if (!userId) throw new DomainError('Unauthorized', 401);

	const broadcast = broadcastFromInput(input);
	const inviteOnly = Boolean(input.inviteOnly);
	const aegisAward = parseAegisAward(
		input.aegisAward ??
			suggestAegisAward({
				startAt: input.startAt,
				format: input.format,
				seriesRules: input.seriesRules,
				inviteOnly,
				title: input.title,
				description: input.description
			})
	);
	const tournament = await prisma.tournament.create({
		data: {
			title: input.title,
			description: input.description,
			format: input.format ?? 'SINGLE_ELIMINATION',
			maxTeams: input.maxTeams ?? 8,
			seriesRules: input.seriesRules ?? 'BO1',
			region: input.region,
			rankCap: input.rankCap,
			prizePool: input.prizePool ?? 0,
			prizeStatus: 'UNCONFIRMED',
			aegisAward,
			inviteOnly,
			startAt: input.startAt,
			checkInOpensAt: input.checkInOpensAt ?? null,
			checkInClosesAt: input.checkInClosesAt ?? null,
			rules: withStreamRule(input.rules, broadcast.twitch ?? input.twitchChannel),
			broadcast,
			status: (input.prizePool ?? 0) > 0 ? 'DRAFT' : 'REGISTRATION',
			createdById: userId
		}
	});

	try {
		await ensureOwnerStaff(tournament.id, userId, 'OWNER');
	} catch {
		/* staff table may not exist until migrate; owner is still createdById */
	}
	try {
		await prisma.auditLog.create({
			data: { actorId: userId, action: 'TOURNAMENT_CREATED', entity: 'Tournament', entityId: tournament.id }
		});
	} catch {
		/* audit is optional for first create */
	}

	return tournament;
}
