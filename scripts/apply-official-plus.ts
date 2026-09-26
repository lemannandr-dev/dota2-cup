import { readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '../lib/prisma';
import { saveOfficialHeroProgress } from '../lib/save-official-hero-progress';

type Payload = {
	accountId: number;
	heroes: Array<{ heroId: number; level: number; xp: number; matchId?: number; source?: string }>;
	public?: Record<string, unknown>;
};

async function main() {
	const file = path.join(process.cwd(), 'scripts', '.official-plus.json');
	const payload = JSON.parse(await readFile(file, 'utf8')) as Payload;
	const steamId = String(BigInt(payload.accountId) + 76561197960265728n);
	const user = await prisma.user.findUnique({ where: { steamId }, select: { id: true, displayName: true } });
	if (!user) {
		throw new Error(`User with steamId ${steamId} not found`);
	}
	const saved = await saveOfficialHeroProgress(
		user.id,
		payload.heroes.map((hero) => ({
			heroId: hero.heroId,
			level: hero.level,
			xp: hero.xp,
			source: hero.source ?? 'replay',
			matchId: hero.matchId
		})),
		{
			helperVersion: 'public-replay',
			detectedAt: new Date().toISOString(),
			steamDetected: true,
			dotaDetected: true,
			heroProgressPresent: payload.heroes.length > 0,
			publicReplayMeta: payload.public
		}
	);
	console.log(JSON.stringify({ user: user.displayName, ...saved, heroes: payload.heroes }, null, 2));
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
