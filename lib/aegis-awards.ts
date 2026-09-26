import { moscowHour } from '@/lib/datetime';

export const AEGIS_AWARD_IDS = ['ember', 'night', 'void', 'relic'] as const;
export type AegisAwardId = (typeof AEGIS_AWARD_IDS)[number];

export type AegisAwardDef = {
	id: AegisAwardId;
	name: string;
	plaque: string;
	caption: string;
	who: string;
	how: string;
	hint: string;
};

export const AEGIS_AWARDS: AegisAwardDef[] = [
	{
		id: 'ember',
		name: 'Эгида огня',
		plaque: 'ЭГИДА ОГНЯ',
		caption: 'открытый кубок',
		who: 'Чемпион открытого кубка',
		how: 'Соберите пятёрку со Steam, заявитесь на открытый кубок, выиграйте финал. Модель появится на визитке только после закрытой пары.',
		hint: 'Обычный weekend. Регистрация открыта. Олимпийка.'
	},
	{
		id: 'night',
		name: 'Ночная эгида',
		plaque: 'НОЧНАЯ ЭГИДА',
		caption: 'старт ночью по МСК',
		who: 'Чемпион ночного кубка',
		how: 'Тот же путь, но кубок стартует с 22:00 до 06:00 МСК — или орг явно ставит ночную эгиду. Финал закрыт — модель на карточке.',
		hint: 'Ночной слот. Не отдельный клиент и не другой рейтинг.'
	},
	{
		id: 'void',
		name: 'Эгида пустоты',
		plaque: 'ЭГИДА ПУСТОТЫ',
		caption: 'закрытый инвайт',
		who: 'Чемпион инвайта',
		how: 'Орг зовёт состав. Открытой заявки нет. Нужно принять инвайт, сыграть сетку и выиграть финал.',
		hint: 'Закрытый список. Не купить и не выбить случайно.'
	},
	{
		id: 'relic',
		name: 'Древний реликт',
		plaque: 'ДРЕВНИЙ РЕЛИКТ',
		caption: 'длинный формат',
		who: 'Чемпион длинного кубка',
		how: 'Кубок с двойным выбыванием или серией BO3/BO5. Пройти сетку до финала и закрыть его. Нижняя сетка тоже считается — это тот же кубок.',
		hint: 'Длиннее уикенда. Не третье место и не утешительный кубок.'
	}
];

export function parseAegisAward(raw: unknown): AegisAwardId {
	return AEGIS_AWARD_IDS.includes(raw as AegisAwardId) ? (raw as AegisAwardId) : 'ember';
}

export function aegisAwardOf(raw: unknown): AegisAwardDef {
	const id = parseAegisAward(raw);
	return AEGIS_AWARDS.find((row) => row.id === id) ?? AEGIS_AWARDS[0]!;
}

export function isMoscowNightHour(hour: number) {
	return hour >= 22 || hour < 6;
}

export function isLongCupFormat(input: { format?: string | null; seriesRules?: string | null }) {
	if (input.format === 'DOUBLE_ELIMINATION') return true;
	return /BO\s*[35]/i.test(input.seriesRules ?? '');
}

export function looksLikeInviteCup(input: { inviteOnly?: boolean; title?: string | null; description?: string | null }) {
	if (input.inviteOnly) return true;
	const text = `${input.title ?? ''} ${input.description ?? ''}`.toLowerCase();
	return /инвайт|invite/.test(text);
}

export function suggestAegisAward(input: {
	startAt?: Date | string | null;
	format?: string | null;
	seriesRules?: string | null;
	inviteOnly?: boolean;
	title?: string | null;
	description?: string | null;
	localHour?: number | null;
}): AegisAwardId {
	if (looksLikeInviteCup(input)) return 'void';
	const hour = input.localHour ?? moscowHour(input.startAt);
	if (hour != null && isMoscowNightHour(hour)) return 'night';
	if (isLongCupFormat(input)) return 'relic';
	return 'ember';
}

export function localHourFromDatetime(value: string) {
	const match = value.match(/T(\d{2})/);
	if (!match) return null;
	const hour = Number(match[1]);
	return Number.isFinite(hour) ? hour : null;
}
