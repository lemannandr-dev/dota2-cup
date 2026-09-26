import { getCurrentSteamUser } from '@/server/auth/session';
import { CreateTournamentScreen } from '@/components/tournaments/CreateTournamentScreen';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function NewTournamentPage() {
	const user = await getCurrentSteamUser();
	const wallet = user
		? await prisma.user.findUnique({ where: { id: user.id }, select: { balance: true } }).catch(() => null)
		: null;
	return <CreateTournamentScreen signedIn={Boolean(user)} walletBalance={wallet?.balance ?? 0} />;
}
