export async function register() {
	if (process.env.NEXT_RUNTIME !== 'nodejs') return;
	if (process.env.DISABLE_TOURNAMENT_TICK === '1') return;
	// Render starts the tick from scripts/render-start.mjs. This dynamic import
	// is not bundled and crashes the production server.
	if (process.env.RENDER) return;
	try {
		const { startTournamentTick } = await import(/* webpackIgnore: true */ './server/jobs/tournament-tick');
		startTournamentTick();
	} catch (error) {
		console.error('tournament tick hook skipped', error);
	}
}
