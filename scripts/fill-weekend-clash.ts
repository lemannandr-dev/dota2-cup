/**
 * Заполняет Aegis Weekend Clash восемью уникальными пятёрками (40 Steam).
 * Исправляет демо, где один аккаунт торчал во всех командах и составы на паре пустые.
 *
 * Запуск: npx tsx scripts/fill-weekend-clash.ts
 * Стенд: postgres :5434
 */
import { PrismaClient } from '@prisma/client';
import { writeRosterSnapshot } from '../lib/roster-swap';

const prisma = new PrismaClient({
	datasources: {
		db: {
			url: process.env.DATABASE_URL?.includes('localhost')
				? process.env.DATABASE_URL
				: 'postgresql://postgres:postgres@localhost:5434/mediagame?schema=public'
		}
	}
});

const TITLE = 'Aegis Weekend Clash';
const STEAM_BASE = 76561199550000000n;

/** OpenDota rank_tier: medal*10 + stars (1–5). */
const SAMPLE_RANKS = [15, 23, 34, 45, 52, 63, 74, 75, 80, 55, 42, 31, 25, 64, 71];

function avatarFor(teamIndex: number, slot: number) {
	// Unique seed per player — avoids the same hash repeating across both sides of a pair.
	return `https://api.dicebear.com/7.x/shapes/png?seed=wc-${teamIndex}-${slot}&size=64`;
}

const ROLE_HINTS = ['carry', 'mid', 'off', 'soft', 'hard'] as const;

function nick(teamIndex: number, slot: number) {
	const tags = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];
	return `${tags[teamIndex]}-${ROLE_HINTS[slot]}`;
}

async function upsertPlayer(teamIndex: number, slot: number, steamOffset: number) {
	const steamId = String(STEAM_BASE + BigInt(steamOffset));
	const userId = `wc-fill-${teamIndex}-${slot}`;
	const displayName = nick(teamIndex, slot);
	const rankTier = SAMPLE_RANKS[(teamIndex * 5 + slot) % SAMPLE_RANKS.length];
	const avatarUrl = avatarFor(teamIndex, slot);
	return prisma.user.upsert({
		where: { userId },
		update: {
			displayName,
			steamId,
			avatarUrl,
			openDotaRankTier: rankTier,
			openDotaMmr: 2000 + teamIndex * 120 + slot * 40,
			openDotaMmrSource: 'estimate',
			lastLoginAt: new Date()
		},
		create: {
			userId,
			displayName,
			steamId,
			avatarUrl,
			role: 'USER',
			openDotaRankTier: rankTier,
			openDotaMmr: 2000 + teamIndex * 120 + slot * 40,
			openDotaMmrSource: 'estimate',
			lastLoginAt: new Date()
		}
	});
}

async function main() {
	const tournament = await prisma.tournament.findFirst({
		where: { title: TITLE },
		include: {
			applications: {
				include: { team: { select: { id: true, name: true, createdById: true } } },
				orderBy: { seed: 'asc' }
			}
		}
	});
	if (!tournament) throw new Error(`Турнир «${TITLE}» не найден`);
	if (tournament.applications.length < 2) throw new Error('Нужно минимум 2 заявки');

	const apps = tournament.applications.slice(0, 8);
	console.log(`Кубок ${tournament.id} · ${apps.length} команд`);

	const teamRosters = new Map<string, Array<{ userId: string; steamId: string | null; displayName: string }>>();

	for (let teamIndex = 0; teamIndex < apps.length; teamIndex++) {
		const app = apps[teamIndex];
		const players = [];
		for (let slot = 0; slot < 5; slot++) {
			const user = await upsertPlayer(teamIndex, slot, teamIndex * 5 + slot);
			players.push(user);
		}

		await prisma.teamMember.deleteMany({ where: { teamId: app.teamId } });
		await prisma.teamMember.createMany({
			data: players.map((user, slot) => ({
				teamId: app.teamId,
				userId: user.id,
				role: slot === 0 ? 'captain' : 'member',
				confirmed: true,
				confirmedAt: new Date(),
				isSubstitute: false
			}))
		});
		await prisma.team.update({
			where: { id: app.teamId },
			data: { createdById: players[0].id }
		});

		const rosterPlayers = players.map((user) => ({
			userId: user.id,
			steamId: user.steamId,
			displayName: user.displayName
		}));
		teamRosters.set(app.teamId, rosterPlayers);

		const previous =
			app.rosterSnapshot && typeof app.rosterSnapshot === 'object' && !Array.isArray(app.rosterSnapshot)
				? {
						...(app.rosterSnapshot as Record<string, unknown>),
						readiness: {
							status: 'READY',
							notifiedAt: new Date().toISOString(),
							respondedAt: new Date().toISOString()
						}
					}
				: {
						readiness: {
							status: 'READY',
							notifiedAt: new Date().toISOString(),
							respondedAt: new Date().toISOString()
						}
					};
		const snapshot = writeRosterSnapshot(previous, rosterPlayers);
		await prisma.teamApplication.update({
			where: { id: app.id },
			data: {
				status: 'IN_BRACKET',
				checkedInAt: app.checkedInAt ?? new Date(),
				rosterSnapshot: snapshot as object
			}
		});

		console.log(`✓ ${app.team.name}: ${rosterPlayers.map((p) => p.displayName).join(', ')}`);
	}

	const allIds = [...teamRosters.values()].flatMap((rows) => rows.map((r) => r.userId));
	if (new Set(allIds).size !== allIds.length) {
		throw new Error('Дубликаты userId между командами — стоп');
	}

	const matches = await prisma.match.findMany({
		where: { tournamentId: tournament.id },
		select: { id: true, teamAId: true, teamBId: true, status: true, rosterA: true, rosterB: true }
	});

	for (const match of matches) {
		const data: { rosterA?: object; rosterB?: object } = {};
		if (match.teamAId && teamRosters.has(match.teamAId)) {
			const prev = match.rosterA && typeof match.rosterA === 'object' ? match.rosterA : {};
			data.rosterA = writeRosterSnapshot(prev, teamRosters.get(match.teamAId)!) as object;
		}
		if (match.teamBId && teamRosters.has(match.teamBId)) {
			const prev = match.rosterB && typeof match.rosterB === 'object' ? match.rosterB : {};
			data.rosterB = writeRosterSnapshot(prev, teamRosters.get(match.teamBId)!) as object;
		}
		if (Object.keys(data).length) {
			await prisma.match.update({ where: { id: match.id }, data });
		}
	}

	console.log(`Пары обновлены: ${matches.filter((m) => m.teamAId && m.teamBId).length} с составами`);
	console.log(`Открыть: http://localhost:3002/tournaments/${tournament.id}#bracket`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
