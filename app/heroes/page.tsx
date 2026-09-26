import { getCurrentSteamUser } from '@/server/auth/session';
import { fetchDotaProfileAnalyticsBySteamId } from '@/lib/dota-stats';
import { mergeOfficialHeroProgress } from '@/lib/hero-progress-display';
import { HeroesCatalog, type CatalogHero } from '@/components/heroes/HeroesCatalog';
import { PlusReplaySyncButton } from '@/components/heroes/PlusReplaySyncButton';
import { DotaPlusHowTo } from '@/components/heroes/DotaPlusHowTo';
import { SteamButton } from '@/components/dota/SteamButton';
import { PlayerAccountRail } from '@/components/layout/PlayerAccountRail';
import { prisma } from '@/lib/prisma';
import { beginPlusSyncJob, readPlusSyncJob } from '@/lib/plus-sync-job';
import { shouldAutoStartPlusSync } from '@/lib/plus-sync-policy';
import { canConsumePlusCdn } from '@/lib/plus-cdn-limit';
import { readPlusCdnUsed } from '@/lib/plus-cdn-usage';

export const dynamic = 'force-dynamic';

type OpenDotaHero = {
	id: number;
	name: string;
	localized_name: string;
	primary_attr: string;
	attack_type: string;
	roles: string[];
};

async function fetchAllHeroes(): Promise<CatalogHero[]> {
	try {
		const response = await fetch('https://api.opendota.com/api/heroes', { next: { revalidate: 86_400 } });
		if (!response.ok) return [];
		const heroes = (await response.json()) as OpenDotaHero[];
		return heroes
			.filter((hero) => hero.id > 0 && hero.name)
			.map((hero) => ({
				id: hero.id,
				name: hero.name,
				localizedName: hero.localized_name,
				primaryAttr: hero.primary_attr,
				attackType: hero.attack_type,
				roles: hero.roles
			}))
			.sort((a, b) => a.localizedName.localeCompare(b.localizedName, 'ru'));
	} catch {
		return [];
	}
}

export default async function HeroesPage() {
	const user = await getCurrentSteamUser();
	const [dota, allHeroes, lastSnapshot] = await Promise.all([
		user?.steamId ? fetchDotaProfileAnalyticsBySteamId(user.steamId) : Promise.resolve(null),
		fetchAllHeroes(),
		user
			? prisma.dotaClientSnapshot.findFirst({
					where: { userId: user.id },
					orderBy: { createdAt: 'desc' },
					select: { createdAt: true, payload: true }
				})
			: Promise.resolve(null)
	]);
	const display = await mergeOfficialHeroProgress(user?.id ?? null, dota?.allHeroesProgress ?? []);
	const snapshot = (lastSnapshot?.payload ?? {}) as {
		plusSubscriber?: boolean;
		cacheFound?: boolean;
		heroProgressPresent?: boolean;
	};
	const plusFromClient = snapshot.plusSubscriber === true;
	const cacheFound = snapshot.cacheFound === true;
	const newestLastPlayedUnix = display.heroes.reduce((max, hero) => Math.max(max, hero.lastPlayed || 0), 0);
	let autoQueued = false;
	if (user?.steamId) {
		const [job, used] = await Promise.all([readPlusSyncJob(user.id), readPlusCdnUsed(user.id)]);
		if (
			canConsumePlusCdn(used).ok &&
			shouldAutoStartPlusSync({
				job,
				capturedAt: display.capturedAt,
				newestLastPlayedUnix
			})
		) {
			const started = await beginPlusSyncJob(user.id, user.steamId);
			autoQueued = started.ok;
		}
	}

	return (
		<main className="max-w-shell mx-auto px-4 md:px-6 lg:px-10 py-12 space-y-8">
			{user ? <PlayerAccountRail profileHref={`/profile/${user.id}`} /> : null}
			<div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
				<div>
					<h1 className="font-display text-3xl text-cream">Герои</h1>
					<p className="mt-2 max-w-2xl text-sm text-muted">
						{display.source === 'official'
							? `Значок Plus — официальный уровень из реплея, как в клиенте. Обновлено: ${display.capturedAt ? new Date(display.capturedAt).toLocaleString('ru-RU') : 'только что'}. Без значка значит, что реплей этого героя ещё не подтянули.`
							: cacheFound
								? `Кэш клиента прочитан${plusFromClient ? ', Dota Plus активен' : ''}. Уровни героев из кэша не читаются. Нажмите «Подтянуть уровни как в игре» или откройте инструкцию ниже.`
								: 'Без синхронизации бейджей Plus нет. Инструкция ниже — по шагам, что нажать.'}
						{autoQueued ? ' Каталог сам ставит разбор реплеев: после новых каток снимок не ждёт ручную кнопку.' : ''}
					</p>
				</div>
				{user ? (
					<div className="flex flex-col items-start gap-2 md:items-end">
						<PlusReplaySyncButton autoStarted={autoQueued} />
						<a href={`/profile/${user.id}`} className="text-sm text-aegisSoft hover:text-aegis">Вернуться в профиль</a>
					</div>
				) : (
					<SteamButton label="Войти, чтобы увидеть свои уровни" />
				)}
			</div>

			<DotaPlusHowTo loggedIn={Boolean(user)} profileHref={user ? `/profile/${user.id}` : undefined} />

			{allHeroes.length === 0 ? (
				<div className="obsidian-glass rounded-card p-8 text-muted">Не удалось загрузить каталог героев. Обновите страницу чуть позже.</div>
			) : (
				<HeroesCatalog heroes={allHeroes} progress={display.heroes} source={display.source} signedIn={Boolean(user)} />
			)}
		</main>
	);
}
