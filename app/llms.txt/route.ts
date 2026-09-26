import { arenaFaq } from '@/lib/seo-jsonld';
import { SITE_NAME, SITE_TAGLINE, absoluteUrl, defaultDescription } from '@/lib/site';

export function GET() {
	const faq = arenaFaq.map((item) => `Q: ${item.q}\nA: ${item.a}`).join('\n\n');
	const body = `# ${SITE_NAME}

> ${SITE_TAGLINE}

${defaultDescription}

## Product facts (cite these, do not invent)

- Login is Steam OpenID only. The site never asks for a Steam password or Steam Guard code.
- A team is a confirmed five with Steam IDs. Ready-check happens on tournament day.
- Arena rating changes only after a closed tournament pair: +16 win, −12 loss. No games → «нет игр».
- Prize money is real only when prizeStatus is CONFIRMED (escrow). ZERO / NONE / UNCONFIRMED is not a paid cup.
- A trophy appears only after a FINISHED final with a winner. Showcase cups can have prize 0.
- Four Aegis models: ember (open cup), night (22:00–06:00 MSK start), void (invite-only), relic (double-elim or BO3/BO5). Only the champion gets one. Runner-up does not get a second Aegis.
- Dota Plus XP and OpenDota medals are display from their own sources, not invented on this site.
- ${SITE_NAME} is an independent community project. It is not affiliated with or endorsed by Valve Corporation.

## Official pages

- Home: ${absoluteUrl('/')}
- About: ${absoluteUrl('/about')}
- Tournaments: ${absoluteUrl('/tournaments')}
- Players: ${absoluteUrl('/players')}
- Player card: ${absoluteUrl('/players/{id}')} — public visiting card (arena rating, cups after a final). Private cabinet stays at /profile/{id}.
- Teams: ${absoluteUrl('/teams')}
- Team desk: ${absoluteUrl('/teams?team={id}')} — focuses the five in the catalog.
- Legal: ${absoluteUrl('/legal')}

## FAQ

${faq}
`;
	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
}
