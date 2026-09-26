import { describe, expect, it } from 'vitest';
import { arenaFaq, organizationJsonLd } from '@/lib/seo-jsonld';
import { defaultDescription, playerCardHref, teamDeskHref } from '@/lib/site';

describe('seo facts', () => {
	it('does not claim Valve affiliation or a reserved prize on the marketing copy', () => {
		expect(defaultDescription).toMatch(/не связан с Valve/i);
		expect(defaultDescription).toMatch(/эскроу/i);
		expect(JSON.stringify(organizationJsonLd())).toMatch(/не является официальным сервисом Valve/i);
		expect(arenaFaq.some((row) => /не (связан|одобрен)/i.test(row.a))).toBe(true);
		expect(arenaFaq.every((row) => !/официальн(ый|ая) (сервис|платформа) Valve/i.test(row.a))).toBe(true);
	});

	it('keeps public card and team desk hrefs stable', () => {
		expect(playerCardHref('u1')).toBe('/players/u1');
		expect(teamDeskHref('t1')).toBe('/teams?team=t1');
	});
});
