import { describe, expect, it } from 'vitest';
import { mapHeroRecentForm } from '@/lib/dota-stats';

function match(partial: { radiant?: boolean; win?: boolean; kills?: number; deaths?: number; assists?: number; gpm?: number; xpm?: number }) {
	const radiant = partial.radiant ?? true;
	const win = partial.win ?? true;
	return {
		player_slot: radiant ? 1 : 128,
		radiant_win: radiant ? win : !win,
		kills: partial.kills ?? 5,
		deaths: partial.deaths ?? 3,
		assists: partial.assists ?? 7,
		gold_per_min: partial.gpm ?? 400,
		xp_per_min: partial.xpm ?? 500
	};
}

describe('mapHeroRecentForm', () => {
	it('builds last-20 pips oldest-to-newest and a current streak from the newest game', () => {
		const mapped = mapHeroRecentForm([
			match({ win: true }),
			match({ win: true }),
			match({ win: false })
		]);
		expect(mapped.form).toEqual(['L', 'W', 'W']);
		expect(mapped.streak).toEqual({ result: 'W', count: 2 });
		expect(mapped.averages).toMatchObject({ kills: 5, deaths: 3, assists: 7, gpm: 400, xpm: 500, kda: 4 });
	});

	it('returns empty form when OpenDota has no matches for the hero', () => {
		expect(mapHeroRecentForm([])).toEqual({ form: [], streak: null, averages: null });
	});
});
