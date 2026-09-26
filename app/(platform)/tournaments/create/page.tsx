import { getCurrentSteamUser } from '@/server/auth/session';
import { CreateTournamentScreen } from '@/components/tournaments/CreateTournamentScreen';

export const dynamic = 'force-dynamic';

export default async function CreateTournamentPage() {
	const user = await getCurrentSteamUser();
	return <CreateTournamentScreen signedIn={Boolean(user)} />;
}
