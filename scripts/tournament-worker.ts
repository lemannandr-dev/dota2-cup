process.env.DISABLE_TOURNAMENT_TICK = '0';

import { runTournamentTick, startTournamentTick } from '../server/jobs/tournament-tick';
import { startPlusSyncWorker } from '../server/jobs/plus-sync';

async function applyDeadlines() {
	const { applyExpiredReportDeadlines } = await import('../server/matches/apply-deadline');
	await applyExpiredReportDeadlines().catch((error) => {
		console.error('report deadline tick failed', error);
	});
}

async function main() {
	console.log('Tournament tick worker started');
	await runTournamentTick().catch((error) => {
		console.error('initial tournament-tick failed', error);
	});
	await applyDeadlines();
	startTournamentTick(applyDeadlines);
	startPlusSyncWorker();
	console.log(`Tournament tick interval ${process.env.TOURNAMENT_TICK_MS || 60000}ms`);
}

void main();
