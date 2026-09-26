import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PlayerVisitingCard } from '@/components/players/PlayerVisitingCard';
import { getCurrentSteamUser } from '@/server/auth/session';
import { loadPlayerCard } from '@/server/players/card';
import { SITE_NAME } from '@/lib/site';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { id } = await params;
	const user = await prisma.user.findUnique({ where: { id }, select: { displayName: true } }).catch(() => null);
	if (!user) return { title: 'Игрок' };
	return {
		title: user.displayName,
		description: `${user.displayName} на ${SITE_NAME}: рейтинг арены из пар турнира, оценка OpenDota из кэша и кубок только после финала.`,
		alternates: { canonical: `/players/${id}` }
	};
}

export default async function PlayerCardPage({ params }: Props) {
	const { id } = await params;
	const session = await getCurrentSteamUser();
	const card = await loadPlayerCard(id, session?.id ?? null).catch(() => null);
	if (!card) notFound();

	return (
		<main className="mx-auto max-w-shell px-4 py-10 md:px-6 lg:px-10">
			<PlayerVisitingCard card={card} />
		</main>
	);
}
