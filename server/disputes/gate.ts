import { prisma } from '@/lib/prisma';
import { canUploadDisputeEvidence, canViewDisputeEvidence } from '@/lib/access-policy';
import { isTournamentReferee } from '@/server/tournaments/staff';
import type { Role } from '@prisma/client';

export async function loadMatchEvidenceGate(matchId: string, user: { id: string; role: Role }) {
	const match = await prisma.match.findUnique({
		where: { id: matchId },
		include: {
			teamA: { select: { createdById: true } },
			teamB: { select: { createdById: true } },
			disputes: { orderBy: { createdAt: 'desc' } }
		}
	});
	if (!match) return null;
	const isReferee = await isTournamentReferee(user.id, user.role, match.tournamentId);
	const input = {
		userId: user.id,
		role: user.role,
		captainAId: match.teamA?.createdById,
		captainBId: match.teamB?.createdById,
		isReferee
	};
	return {
		match,
		isReferee,
		canUpload: canUploadDisputeEvidence(input),
		canView: canViewDisputeEvidence(input)
	};
}

export function publicDisputeRow(
	dispute: {
		id: string;
		reason: string;
		details: string | null;
		status: string;
		evidenceKind: string | null;
		evidenceUrl: string | null;
		evidenceKey: string | null;
		evidenceName: string | null;
		createdAt: Date;
	},
	canView: boolean
) {
	return {
		id: dispute.id,
		reason: dispute.reason,
		details: dispute.details,
		status: dispute.status,
		createdAt: dispute.createdAt.toISOString(),
		hasEvidence: Boolean(dispute.evidenceKey || dispute.evidenceUrl),
		evidenceKind: canView ? dispute.evidenceKind : null,
		evidenceUrl: canView ? dispute.evidenceUrl : null,
		evidenceName: canView ? dispute.evidenceName : null
	};
}
