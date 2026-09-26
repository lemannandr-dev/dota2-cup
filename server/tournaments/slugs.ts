export const TOURNAMENT_RESERVED_SLUGS = ['new', 'create'] as const;

export function isReservedTournamentSlug(id: string): boolean {
	return TOURNAMENT_RESERVED_SLUGS.includes(id as (typeof TOURNAMENT_RESERVED_SLUGS)[number]);
}
