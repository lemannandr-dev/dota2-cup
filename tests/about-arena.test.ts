import { describe, expect, it } from 'vitest';
import { aboutRoundLabel, groupBracketRounds, mapAboutCup, pickAboutCups, schematicEightBracket } from '@/lib/about-arena';

describe('about arena', () => {
	it('labels the last three rounds as cup stages', () => {
		expect(aboutRoundLabel(1, 3)).toBe('Четвертьфинал');
		expect(aboutRoundLabel(2, 3)).toBe('Полуфинал');
		expect(aboutRoundLabel(3, 3)).toBe('Финал');
	});

	it('groups pairs by round without inventing winners', () => {
		const rounds = groupBracketRounds([
			{ id: 'b', round: 2, teamA: 'A', teamB: 'B', scoreA: 2, scoreB: 1, live: false, done: true },
			{ id: 'a', round: 1, teamA: 'C', teamB: 'D', scoreA: null, scoreB: null, live: true, done: false }
		]);
		expect(rounds.map((row) => row[0]?.id)).toEqual(['a', 'b']);
	});

	it('keeps a schematic 1-vs-8 seed and does not award a cup', () => {
		const story = schematicEightBracket();
		expect(story.source).toBe('schematic');
		expect(story.rounds[0]?.[0]).toMatchObject({ teamA: 'Посев 1', teamB: 'Посев 8' });
		expect(story.rounds[2]?.[0]?.teamA).toBe('Полуфинал');
	});

	it('shows a trophy only after a finished final', () => {
		const open = mapAboutCup({
			id: 't1',
			title: 'Clash',
			status: 'LIVE',
			format: 'SINGLE_ELIMINATION',
			prizePool: 0,
			prizeStatus: 'NONE',
			maxTeams: 8,
			teams: 4,
			trophy: null
		});
		expect(open.awarded).toBe(false);
		expect(open.href).toBe('/tournaments/t1');
		const awarded = pickAboutCups([
			open,
			mapAboutCup({
				id: 't2',
				title: 'Closed',
				status: 'FINISHED',
				format: 'SINGLE_ELIMINATION',
				prizePool: 0,
				prizeStatus: 'NONE',
				maxTeams: 8,
				teams: 8,
				aegisAward: 'relic',
				trophy: {
					year: 2026,
					title: 'Closed',
					engraving: 'Iskry',
					winnerTeamId: 'x',
					winnerTeamName: 'Iskry',
					description: '',
					players: [],
					prizeLabel: 'Без фонда',
					prizeKind: 'none',
					prizeHint: null,
					finalScore: '2:0',
					runnerUpTeamName: 'Dire',
					teams: [],
					highlights: [],
					award: {
						id: 'relic',
						name: 'Древний реликт',
						plaque: 'ДРЕВНИЙ РЕЛИКТ',
						caption: 'длинный формат',
						who: 'Чемпион длинного кубка',
						how: '',
						hint: ''
					}
				}
			})
		]);
		expect(awarded.map((row) => row.id)).toEqual(['t1', 't2']);
		expect(awarded[1]?.awarded).toBe(true);
		expect(awarded[1]?.href).toContain('/cup');
	});
});
