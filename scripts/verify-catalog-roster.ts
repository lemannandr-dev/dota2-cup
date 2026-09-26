import { loadTournamentCatalog } from '../server/tournaments/catalog';
import { generateSessionToken, hashToken } from '../lib/steam';
import { prisma } from '../lib/prisma';

async function main() {
	const user = await prisma.user.findUnique({
		where: { steamId: '76561198835548729' },
		select: { id: true, displayName: true }
	});
	if (!user) throw new Error('o555aa not found');
	const cups = await loadTournamentCatalog(user.id);
	const mine = cups
		.filter((cup) => cup.mine)
		.map((cup) => ({
			title: cup.title,
			team: cup.mine!.teamName,
			withSteam: cup.mine!.withSteam,
			needed: cup.mine!.needed,
			members: cup.mine!.members.map((member) => ({
				name: member.displayName,
				mmr: member.mmr,
				hasSteam: member.hasSteam
			}))
		}));

	const token = generateSessionToken();
	const session = await prisma.session.create({
		data: {
			sessionToken: hashToken(token),
			userId: user.id,
			expires: new Date(Date.now() + 5 * 60 * 1000)
		}
	});
	let html = '';
	try {
		const res = await fetch('http://127.0.0.1:3000/tournaments', {
			headers: { cookie: `aegis_session=${token}` },
			cache: 'no-store'
		});
		html = await res.text();
		if (!res.ok) throw new Error(`tournaments HTTP ${res.status}`);
	} finally {
		await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
	}

	const clash = mine.find((row) => row.title.includes('Clash'));
	const checks = {
		mineCount: mine.length,
		o555aaOnClash: clash?.members.some((member) => member.name === 'o555aa' && member.mmr?.value === 4030) ?? false,
		htmlHasMine: html.includes('Мои кубки'),
		htmlHasEstimate: html.includes('оценка 4030'),
		htmlHasInvite: html.includes('пригласить'),
		htmlHasRosterGrid: html.includes('grid-cols-5')
	};
	if (!checks.o555aaOnClash || !checks.htmlHasMine || !checks.htmlHasEstimate || !checks.htmlHasInvite) {
		throw new Error(`catalog roster UI missing: ${JSON.stringify({ user, mine, checks })}`);
	}
	console.log(JSON.stringify({ user, mine, checks }, null, 2));
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
