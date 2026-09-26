'use client';

import { useTournamentLive } from '@/components/tournaments/useTournamentLive';

export function TournamentLive({ tournamentId }: { tournamentId: string }) {
	useTournamentLive(tournamentId);
	return null;
}
