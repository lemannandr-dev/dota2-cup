/**
 * Один раз вешает Weekend Clash на орга стенда.
 * Не печатает деньги: CONFIRMED без эскроу сбрасывается в UNCONFIRMED.
 */
import { prisma } from '../lib/prisma';
import { claimOrphanTournament } from '../server/tournaments/claim-owner';

const CUP_ID = 'cmt4950sv0000e79itux9u2l1';
const ORG_ID = 'cmt397c1e00001536lgemhbrw';

async function main() {
	const result = await claimOrphanTournament(CUP_ID, ORG_ID);
	console.log(JSON.stringify(result, null, 2));
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
