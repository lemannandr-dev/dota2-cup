// Mock data for the landing preview. All values are demo data, not live analytics.
import type { HeroKey, RankTier, RankStars } from './assets';

export type LfgKind = 'tournament' | 'today' | 'invites' | 'roster' | 'league';

export interface MockPlayer {
	nickname: string;
	rank: { tier: RankTier; stars?: RankStars; leaderboard?: number };
	roles: number[];
	topHeroes: HeroKey[];
	winRate: number;
	matches: number;
	recent: string;
	reliability: number;
	lfg: string;
	lfgKind: LfgKind;
	canInvite: boolean;
}

export const players: MockPlayer[] = [
	{
		nickname: 'KITE',
		rank: { tier: 'immortal', leaderboard: 1843 },
		roles: [1, 2],
		topHeroes: ['juggernaut', 'phantomAssassin', 'invoker'],
		winRate: 56.8,
		matches: 412,
		recent: '7–3',
		reliability: 96,
		lfg: 'Ищет пати на турнир',
		lfgKind: 'tournament',
		canInvite: true
	},
	{
		nickname: 'VEX',
		rank: { tier: 'divine', stars: 2 },
		roles: [4, 5],
		topHeroes: ['crystalMaiden', 'axe'],
		winRate: 54.2,
		matches: 284,
		recent: '6–4',
		reliability: 100,
		lfg: 'Свободен сегодня 19:00–00:00',
		lfgKind: 'today',
		canInvite: true
	},
	{
		nickname: 'SABLE',
		rank: { tier: 'ancient', stars: 5 },
		roles: [2],
		topHeroes: ['invoker', 'phantomAssassin'],
		winRate: 52.9,
		matches: 361,
		recent: '5–5',
		reliability: 91,
		lfg: 'Рассматривает приглашения',
		lfgKind: 'invites',
		canInvite: true
	},
	{
		nickname: 'MIRA',
		rank: { tier: 'legend', stars: 4 },
		roles: [5, 4],
		topHeroes: ['crystalMaiden', 'axe'],
		winRate: 51.7,
		matches: 198,
		recent: '6–4',
		reliability: 98,
		lfg: 'Уже в составе 4/5',
		lfgKind: 'roster',
		canInvite: false
	},
	{
		nickname: 'DUSK',
		rank: { tier: 'archon', stars: 5 },
		roles: [3],
		topHeroes: ['axe', 'juggernaut'],
		winRate: 53.1,
		matches: 226,
		recent: '7–3',
		reliability: 94,
		lfg: 'Ищет любительскую лигу',
		lfgKind: 'league',
		canInvite: true
	}
];

export type PrizeStatus = 'verified' | 'pending' | 'none';

export interface MockTournament {
	id: string;
	name: string;
	format: string;
	series: string;
	region: 'EU West' | 'EU East' | 'CIS';
	language: string;
	rankCap: string;
	teams: number;
	maxTeams: number;
	prize: string;
	prizeStatus: PrizeStatus;
	organizer: string;
	organizerReliability: number;
	deadline: string;
	status: 'registration' | 'soon' | 'live' | 'finished';
}

export const tournaments: MockTournament[] = [
	{
		id: 'winter-open-1',
		name: 'Winter Open #1',
		format: 'Double Elimination',
		series: 'BO1 · финал BO3',
		region: 'EU East',
		language: 'RU',
		rankCap: 'До Титана',
		teams: 12,
		maxTeams: 16,
		prize: '150 000 ₽',
		prizeStatus: 'verified',
		organizer: 'Frostbite League',
		organizerReliability: 98,
		deadline: '01д 12ч 44м',
		status: 'registration'
	},
	{
		id: 'ancient-cup',
		name: 'Ancient Cup',
		format: 'Single Elimination',
		series: 'BO3',
		region: 'CIS',
		language: 'RU',
		rankCap: 'До Властелина',
		teams: 7,
		maxTeams: 8,
		prize: 'Без фонда',
		prizeStatus: 'none',
		organizer: 'Community Hub',
		organizerReliability: 92,
		deadline: '06ч 12м',
		status: 'registration'
	},
	{
		id: 'night-stack-league',
		name: 'Night Stack League',
		format: 'Double Elimination',
		series: 'BO1',
		region: 'EU West',
		language: 'RU / EN',
		rankCap: 'Без ограничений',
		teams: 18,
		maxTeams: 32,
		prize: '50 000 ₽',
		prizeStatus: 'pending',
		organizer: 'Night Stack',
		organizerReliability: 87,
		deadline: '3д 02ч',
		status: 'registration'
	}
];

export interface BracketMatch {
	id: string;
	round: string;
	teamA: string;
	teamB: string;
	scoreA?: number;
	scoreB?: number;
	date: string;
	bo: string;
	winner?: 'A' | 'B';
	live?: boolean;
}

export const bracketPreview: BracketMatch[] = [
	{ id: 'w1', round: 'Верхняя сетка · R1', teamA: 'Storm Five', teamB: 'Iron Creeps', scoreA: 1, scoreB: 0, date: '21.08 18:00', bo: 'BO1', winner: 'A' },
	{ id: 'w2', round: 'Верхняя сетка · R1', teamA: 'Midlane Kings', teamB: 'Aegis Rats', scoreA: 0, scoreB: 1, date: '21.08 19:00', bo: 'BO1', winner: 'B' },
	{ id: 'wf', round: 'Финал верхней', teamA: 'Storm Five', teamB: 'Aegis Rats', date: '22.08 18:00', bo: 'BO3', live: true },
	{ id: 'lr', round: 'Нижняя сетка', teamA: 'Iron Creeps', teamB: 'Midlane Kings', date: '22.08 16:00', bo: 'BO1' },
	{ id: 'gf', round: 'Гранд-финал', teamA: 'TBD', teamB: 'TBD', date: '23.08 19:00', bo: 'BO3' }
];

export interface HeroStat {
	hero: HeroKey;
	matches: number;
	wins: number;
	pickShare: number;
	mastery: number;
}

export const heroStats: HeroStat[] = [
	{ hero: 'crystalMaiden', matches: 42, wins: 25, pickShare: 14.8, mastery: 82 },
	{ hero: 'axe', matches: 37, wins: 19, pickShare: 13.0, mastery: 74 },
	{ hero: 'invoker', matches: 29, wins: 14, pickShare: 10.2, mastery: 61 },
	{ hero: 'juggernaut', matches: 24, wins: 13, pickShare: 8.5, mastery: 66 },
	{ hero: 'phantomAssassin', matches: 18, wins: 9, pickShare: 6.3, mastery: 55 }
];

export type Period = '20m' | '100m' | '30d' | 'patch' | 'all';

export const periodLabels: Record<Period, string> = {
	'20m': '20 матчей',
	'100m': '100 матчей',
	'30d': '30 дней',
	patch: 'Текущий патч',
	all: 'Вся история'
};

// Selected-hero detail per period (mock variation to keep controls live).
export interface HeroDetail {
	matches: number;
	wins: number;
	losses: number;
	winRate: number;
	pickShare: number;
	kda: string;
	gpm: number;
	xpm: number;
	pos5: number;
	pos4: number;
	form: string;
	mastery: number;
	quality: string;
}

export const heroDetailByPeriod: Record<Period, HeroDetail> = {
	'20m': { matches: 8, wins: 5, losses: 3, winRate: 62.5, pickShare: 40.0, kda: '3,4 / 6,1 / 16,0', gpm: 344, xpm: 520, pos5: 75, pos4: 25, form: '+6,4 п.п. к предыдущим 20 матчам', mastery: 82, quality: 'Малая выборка' },
	'100m': { matches: 42, wins: 25, losses: 17, winRate: 59.5, pickShare: 14.8, kda: '3,1 / 6,8 / 15,4', gpm: 338, xpm: 512, pos5: 74, pos4: 26, form: '+6,4 п.п. к предыдущим 20 матчам', mastery: 82, quality: 'Достаточная выборка' },
	'30d': { matches: 17, wins: 10, losses: 7, winRate: 58.8, pickShare: 18.9, kda: '3,0 / 6,5 / 15,9', gpm: 341, xpm: 509, pos5: 71, pos4: 29, form: '+2,1 п.п. к предыдущему периоду', mastery: 82, quality: 'Малая выборка' },
	patch: { matches: 11, wins: 6, losses: 5, winRate: 54.5, pickShare: 16.4, kda: '2,8 / 7,0 / 14,7', gpm: 332, xpm: 501, pos5: 82, pos4: 18, form: '−1,3 п.п. к прошлому патчу', mastery: 82, quality: 'Малая выборка' },
	all: { matches: 63, wins: 36, losses: 27, winRate: 57.1, pickShare: 12.2, kda: '3,0 / 6,9 / 15,1', gpm: 335, xpm: 506, pos5: 76, pos4: 24, form: 'Стабильная форма', mastery: 82, quality: 'Достаточная выборка' }
};

export const playerSummary = {
	nickname: 'VEX',
	rank: { tier: 'divine' as RankTier, stars: 2 as RankStars },
	dotaPlus: 'Не удалось определить',
	guildLeader: 'Не подтверждено',
	clubRole: 'Капитан состава',
	matches: 284,
	wins: 154,
	losses: 130,
	winRate: '54,2% · 284 матча',
	kda: '3,84',
	gpm: 486,
	xpm: 612,
	roles: [
		{ pos: 4, share: 62 },
		{ pos: 5, share: 31 }
	],
	lastSync: '18 мин назад',
	lastTen: ['В', 'В', 'П', 'В', 'В', 'П', 'В', 'В', 'П', 'В'] as const
};
