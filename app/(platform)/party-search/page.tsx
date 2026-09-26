import { getCurrentSteamUser } from '@/lib/steam-session';
import { loadPartySearchBoard, touchArenaPresence } from '@/server/party/board';
import { PartySearchBoard } from '@/components/players/PartySearchBoard';

export const dynamic = 'force-dynamic';

export default async function PartySearchPage({ searchParams }: { searchParams: Promise<{ invite?: string; tab?: string; playerId?: string; tournamentId?: string; teamId?: string; q?: string }> }) {
	const { invite, tab, playerId, tournamentId, teamId, q } = await searchParams;
	const currentUser = await getCurrentSteamUser();
	if (currentUser) await touchArenaPresence(currentUser.id);
	const board = await loadPartySearchBoard(currentUser?.id ?? null, playerId ?? null).catch(() => ({
		lfgPosts: [],
		players: [],
		myTeams: [],
		openCups: [],
		myLfg: null
	}));

	return (
		<main className="max-w-shell mx-auto px-4 md:px-6 lg:px-10 py-12">
			<h1 className="font-display text-3xl text-cream mb-2">Поиск пати</h1>
			<p className="text-sm text-muted mb-8">
				Анкета с ролями и приглашение в команду. Только игроки, которые уже заходили на арену через Steam. Рейтинг — арена, не медаль OpenDota.
			</p>
			<PartySearchBoard
				players={board.players}
				lfgPosts={board.lfgPosts}
				myTeams={board.myTeams}
				openCups={board.openCups}
				myLfg={board.myLfg}
				currentUserId={currentUser?.id ?? null}
				initialTab={invite || tab === 'players' || Boolean(playerId) ? 'players' : 'lfg'}
				initialTeamId={teamId ?? null}
				initialTournamentId={tournamentId ?? null}
				initialQuery={q ?? null}
				focusPlayerId={playerId ?? null}
			/>
		</main>
	);
}
