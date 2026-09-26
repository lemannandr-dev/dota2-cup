export async function register() {
	if (process.env.NEXT_RUNTIME !== 'nodejs') return;
	if (process.env.DISABLE_TOURNAMENT_TICK === '1') return;
	const { startTournamentTick } = await import(/* webpackIgnore: true */ './server/jobs/tournament-tick');
	startTournamentTick();
}
