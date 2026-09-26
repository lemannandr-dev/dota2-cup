import { getCurrentSteamUser } from '@/server/auth/session';
import { fetchHeroDetailBySteamId } from '@/lib/dota-stats';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	const user = await getCurrentSteamUser();
	if (!user) return Response.json({ error: 'Войдите через Steam.' }, { status: 401 });
	const heroId = Number((await params).id);
	if (!Number.isInteger(heroId) || heroId <= 0) {
		return Response.json({ error: 'Неизвестный герой.' }, { status: 400 });
	}
	const stats = await fetchHeroDetailBySteamId(user.steamId, heroId);
	if (!stats) return Response.json({ error: 'Нет данных OpenDota по этому герою.' }, { status: 404 });
	return Response.json({ stats }, { headers: { 'Cache-Control': 'no-store' } });
}
