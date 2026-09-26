export function isCupDryRun(title: string) {
	return title.trim().startsWith('Прогон приза');
}

export function isCupShowcase(title: string) {
	return title.trim().startsWith('Витрина кубка');
}

export function cupCardTitle(title: string) {
	if (isCupDryRun(title)) return 'Прогон приза';
	return title;
}

export function cupPublicHref(tournamentId: string) {
	return `/tournaments/${tournamentId}/cup`;
}
