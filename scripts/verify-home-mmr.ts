import { loadHomeLiveBoards } from '../server/home/live-boards';
import { loadRosterGaps } from '../server/home/roster-gaps';
import { homeCupHint, homeStepAction, liveHomePairCount, ownOpenHomePairs, pickPrimaryHomeStep } from '../lib/home-live';
import { prisma } from '../lib/prisma';

async function main() {
	const user = await prisma.user.findUnique({
		where: { steamId: '76561198835548729' },
		select: {
			id: true,
			displayName: true,
			openDotaMmr: true,
			openDotaMmrSource: true,
			openDotaRankTier: true,
			rating: true
		}
	});
	if (!user) throw new Error('o555aa not found');
	const [cards, gaps] = await Promise.all([loadHomeLiveBoards(user.id), loadRosterGaps(user.id)]);
	const primary = pickPrimaryHomeStep(cards, gaps);
	const report = {
		user: {
			id: user.id,
			displayName: user.displayName,
			openDotaMmr: user.openDotaMmr,
			openDotaMmrSource: user.openDotaMmrSource,
			openDotaRankTier: user.openDotaRankTier,
			arenaRating: user.rating,
			mmrIsNotArena: user.openDotaMmr !== user.rating
		},
		cards: cards.length,
		livePairs: liveHomePairCount(cards),
		ownOpenPairs: ownOpenHomePairs(cards).map((card) => card.id),
		gaps,
		primary:
			primary?.kind === 'card'
				? { kind: 'card', title: primary.card.title, raw: primary.card.action.label, shown: homeStepAction(primary.card).label, cup: homeCupHint(primary.card) }
				: primary,
		cardActions: cards.map((card) => ({
			id: card.id,
			title: card.title,
			action: card.action.code,
			isCaptain: card.isCaptain,
			isSubstitute: card.isSubstitute,
			matchId: card.matchId,
			matchStatus: card.matchStatus
		}))
	};
	console.log(JSON.stringify(report, null, 2));
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
