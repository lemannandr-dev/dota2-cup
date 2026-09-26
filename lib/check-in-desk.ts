export type CheckInDeskApp = {
	id: string;
	status: string;
	teamId?: string;
	team?: { id?: string; name?: string } | null;
};

const SILENT = new Set(['SUBMITTED', 'APPROVED', 'NEEDS_ACTION']);
const PRESENT = new Set(['CHECKED_IN', 'IN_BRACKET']);

export function summarizeCheckIn(apps: CheckInDeskApp[]) {
	const silentTeams = apps
		.filter((app) => SILENT.has(app.status))
		.map((app) => ({
			id: app.id,
			name: app.team?.name ?? app.teamId ?? app.id,
			status: app.status
		}));
	return {
		present: apps.filter((app) => PRESENT.has(app.status)).length,
		silent: silentTeams.length,
		dropped: apps.filter((app) => app.status === 'NO_CHECK_IN').length,
		silentTeams
	};
}
