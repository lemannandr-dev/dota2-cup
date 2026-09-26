/**
 * Живой прогон кубка на стенде: две пятёрки → чек-ин → сетка → два счёта → выплата с TOTP.
 * Не трогает Aegis Weekend Clash. Стендовые игроки — только уникальные SteamID, не Plus и не гильдия.
 */
import { prisma } from '../lib/prisma';
import { generateTotpSecret, totpAuthUrl, totpCode, verifyTotp } from '../lib/totp';
import { payoutTotpGate } from '../lib/payout-totp';
import { createTournamentDraft } from '../server/tournaments/create';
import { publishTournament, transitionTournamentStatus } from '../server/tournaments/publish';
import { registerTeam } from '../server/tournaments/register';
import { reviewApplication } from '../server/tournaments/review';
import { checkInTeam } from '../server/tournaments/check-in';
import { generateTournamentBracket } from '../server/tournaments/generate-bracket';
import { saveMatchLobby } from '../server/matches/lobby';
import { submitCaptainReport } from '../server/matches/report';
import { runTournamentTick } from '../server/jobs/tournament-tick';
import { payTournamentPrizes } from '../server/prizes/payout';

const ORG_ID = 'cmt397c1e00001536lgemhbrw';
const PRIZE = 10_000;
const STEAM_BASE = 76561199000001000n;

async function ensurePlayer(index: number) {
	const steamId = String(STEAM_BASE + BigInt(index));
	const userId = `dry-run-${index}`;
	return prisma.user.upsert({
		where: { userId },
		update: { steamId, displayName: `Прогон ${index}` },
		create: {
			userId,
			username: `dry_run_${index}`,
			displayName: `Прогон ${index}`,
			steamId,
			role: 'USER'
		}
	});
}

async function ensureTeam(name: string, tag: string, captainId: string, memberIds: string[]) {
	const existing = await prisma.team.findFirst({
		where: { name, createdById: captainId, deletedAt: null }
	});
	const team =
		existing ??
		(await prisma.team.create({
			data: {
				name,
				tag,
				game: 'Dota 2',
				recruitmentStatus: 'CLOSED',
				createdById: captainId
			}
		}));
	for (const [idx, userId] of memberIds.entries()) {
		await prisma.teamMember.upsert({
			where: { teamId_userId: { teamId: team.id, userId } },
			update: { confirmed: true, confirmedAt: new Date(), isSubstitute: false, role: idx === 0 ? 'captain' : 'member' },
			create: {
				teamId: team.id,
				userId,
				role: idx === 0 ? 'captain' : 'member',
				confirmed: true,
				confirmedAt: new Date(),
				isSubstitute: false
			}
		});
	}
	return team;
}

async function main() {
	const log: string[] = [];
	const step = (line: string) => {
		log.push(line);
		console.log(line);
	};

	const org = await prisma.user.findUnique({ where: { id: ORG_ID } });
	if (!org) throw new Error('Организатор o555aa не найден — войдите через Steam на стенде');

	await prisma.user.update({
		where: { id: org.id },
		data: {
			role: org.role === 'USER' ? 'ORGANIZER' : org.role,
			balance: { increment: PRIZE }
		}
	});
	step(`орг ${org.displayName}: баланс +${PRIZE / 100} ₽ под эскроу`);

	let totpSecret = org.totpSecret;
	if (!org.totpEnabledAt || !totpSecret) {
		totpSecret = generateTotpSecret();
		await prisma.user.update({
			where: { id: org.id },
			data: { totpSecret, totpEnabledAt: new Date() }
		});
		step(`TOTP включён. Добавьте в приложение: ${totpAuthUrl(totpSecret, org.displayName)}`);
		step(`секрет (стенд): ${totpSecret}`);
	} else {
		step('TOTP уже был включён — используем текущий ключ');
	}

	const players = await Promise.all(Array.from({ length: 10 }, (_, i) => ensurePlayer(i + 1)));
	const radiant = await ensureTeam(
		'Прогон Radiant',
		'DRY1',
		players[0].id,
		players.slice(0, 5).map((p) => p.id)
	);
	const dire = await ensureTeam(
		'Прогон Dire',
		'DRY2',
		players[5].id,
		players.slice(5, 10).map((p) => p.id)
	);
	step(`составы 5/5 Steam: ${radiant.name} и ${dire.name}`);

	const now = new Date();
	const tournament = await createTournamentDraft(org.id, 'ORGANIZER', {
		title: `Прогон приза ${now.toISOString().slice(0, 16).replace('T', ' ')}`,
		description: 'Стендовый прогон: две пятёрки, чек-ин, сетка, два счёта, выплата с TOTP. Не Weekend Clash.',
		format: 'SINGLE_ELIMINATION',
		maxTeams: 8,
		seriesRules: 'BO1',
		prizePool: PRIZE,
		startAt: new Date(now.getTime() + 20 * 60_000),
		checkInOpensAt: new Date(now.getTime() - 5 * 60_000),
		checkInClosesAt: new Date(now.getTime() + 60 * 60_000)
	});
	step(`черновик ${tournament.id} · фонд ${PRIZE / 100} ₽`);

	await publishTournament(tournament.id, org.id);
	const afterPublish = await prisma.tournament.findUnique({
		where: { id: tournament.id },
		select: { status: true, prizeStatus: true }
	});
	step(`опубликован: ${afterPublish?.status} · эскроу ${afterPublish?.prizeStatus}`);
	if (afterPublish?.prizeStatus !== 'CONFIRMED') {
		throw new Error('Эскроу не встал — прогон останавливаем до выплаты');
	}

	const appA = await registerTeam(tournament.id, radiant.id, players[0].id);
	const appB = await registerTeam(tournament.id, dire.id, players[5].id);
	await reviewApplication(tournament.id, appA.id, org.id, 'APPROVED');
	await reviewApplication(tournament.id, appB.id, org.id, 'APPROVED');
	step('заявки поданы и одобрены');

	await transitionTournamentStatus(tournament.id, org.id, 'CHECK_IN');
	await checkInTeam(tournament.id, radiant.id, players[0].id);
	await checkInTeam(tournament.id, dire.id, players[5].id);
	step('чек-ин обеих пятёрок');

	const bracket = await generateTournamentBracket(tournament.id, org.id);
	const openMatch = await prisma.match.findFirst({
		where: { tournamentId: tournament.id, teamAId: { not: null }, teamBId: { not: null } },
		orderBy: [{ round: 'asc' }, { position: 'asc' }]
	});
	if (!openMatch) throw new Error('После сетки нет пары с двумя командами');
	step(`сетка ${bracket.matchCount} пар · играем ${openMatch.id}`);

	await saveMatchLobby(openMatch.id, players[0].id, 'USER', {
		name: 'Aegis Dry Run',
		password: 'radiant',
		region: 'EU East',
		voiceUrl: 'https://discord.gg/aegis-dry-run',
		playing: false
	});
	step('лобби выложено: Aegis Dry Run / radiant');

	const first = await submitCaptainReport(openMatch.id, players[0].id, 1, 0);
	step(`счёт Radiant: ${first.state}`);
	const second = await submitCaptainReport(openMatch.id, players[5].id, 1, 0);
	step(`счёт Dire: ${second.state}`);

	await runTournamentTick();
	const finished = await prisma.tournament.findUnique({
		where: { id: tournament.id },
		select: { status: true, prizeStatus: true }
	});
	step(`после тика: ${finished?.status}`);

	const code = totpCode(totpSecret);
	const gate = payoutTotpGate({
		prizePool: PRIZE,
		totpEnabled: true,
		codeValid: verifyTotp(totpSecret, code),
		action: 'confirm'
	});
	if (!gate.ok) throw new Error(gate.error);
	step(`TOTP код принят`);

	const paid = await payTournamentPrizes(tournament.id, org.id);
	const allocations = await prisma.prizeAllocation.findMany({
		where: { tournamentId: tournament.id },
		orderBy: { place: 'asc' }
	});
	step(`выплата: строк ${paid.paid}`);
	for (const row of allocations) {
		step(`  ${row.place} место · ${row.amount / 100} ₽ · ${row.status}`);
	}

	console.log('\nГотово.');
	console.log(`http://localhost:3002/tournaments/${tournament.id}`);
	console.log(log.join('\n'));
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
