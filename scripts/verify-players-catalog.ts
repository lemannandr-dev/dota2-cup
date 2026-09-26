import { loadPlayersCatalog } from '../server/players/catalog';
import { loadPlayerCard } from '../server/players/card';
import { generateSessionToken, hashToken } from '../lib/steam';
import { prisma } from '../lib/prisma';

async function main() {
	const user = await prisma.user.findUnique({
		where: { steamId: '76561198835548729' },
		select: { id: true, displayName: true }
	});
	if (!user) throw new Error('o555aa not found');

	const { players, viewer } = await loadPlayersCatalog(user.id);
	const me = players.find((player) => player.id === user.id);
	const card = await loadPlayerCard(user.id, user.id);
	if (!me || !card) throw new Error('o555aa missing from catalog or card');

	const token = generateSessionToken();
	const session = await prisma.session.create({
		data: {
			sessionToken: hashToken(token),
			userId: user.id,
			expires: new Date(Date.now() + 5 * 60 * 1000)
		}
	});
	let listHtml = '';
	let cardHtml = '';
	try {
		const [listRes, cardRes] = await Promise.all([
			fetch('http://127.0.0.1:3000/players', { headers: { cookie: `aegis_session=${token}` }, cache: 'no-store' }),
			fetch(`http://127.0.0.1:3000/players/${user.id}`, { headers: { cookie: `aegis_session=${token}` }, cache: 'no-store' })
		]);
		listHtml = await listRes.text();
		cardHtml = await cardRes.text();
		if (!listRes.ok) throw new Error(`players HTTP ${listRes.status}`);
		if (!cardRes.ok) throw new Error(`player card HTTP ${cardRes.status}`);
	} finally {
		await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
	}

	const checks = {
		viewerCanInvite: viewer.canInvite,
		meOnline: me.online,
		meMmr: me.mmr,
		meTeam: me.team?.name ?? null,
		cardMembers: card.members.map((member) => ({ name: member.displayName, mmr: member.mmr })),
		listHasChips: listHtml.includes('Ищут пати') && listHtml.includes('На арене'),
		listHasEstimate: listHtml.includes('MMR') && listHtml.includes('4030'),
		listHasSelf: listHtml.includes('это вы'),
		listDropsFree: !listHtml.includes('Свободны'),
		cardHasRoster: cardHtml.includes('пригласить') || cardHtml.includes('состав'),
		cardHasTeam: Boolean(me.team && cardHtml.includes(me.team.name))
	};

	if (!checks.meMmr || checks.meMmr.value !== 4030 || !checks.listHasEstimate || !checks.listHasSelf || !checks.listDropsFree || !checks.cardHasTeam) {
		throw new Error(`players catalog UI missing: ${JSON.stringify(checks)}`);
	}
	console.log(JSON.stringify({ user, checks }, null, 2));
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
