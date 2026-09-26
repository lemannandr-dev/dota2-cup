import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Каталог игроков и LFG живут в одном мобильном сценарии `/party-search`. */
export default async function PlayersPage({ searchParams }: { searchParams: Promise<{ invite?: string; join?: string; q?: string }> }) {
	const params = await searchParams;
	const query = new URLSearchParams({ tab: 'players' });
	if (params.invite) query.set('invite', params.invite);
	if (params.join) query.set('join', params.join);
	if (params.q) query.set('q', params.q);
	redirect(`/party-search?${query.toString()}`);
}
