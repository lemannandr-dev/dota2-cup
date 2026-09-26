import { describeEscrowWallet, defaultPlaceSplit, formatPrizeAmount } from '@/lib/prize-places';
import type { AegisAwardId } from '@/lib/aegis-awards';

export const TOURNAMENT_CREATE_DRAFT_KEY = 'aegis.tournament.create.draft.v1';

export type TournamentCreateWizardStep = 'basics' | 'schedule' | 'prize' | 'broadcast' | 'review';

export const TOURNAMENT_CREATE_STEPS: Array<{ id: TournamentCreateWizardStep; label: string; hint: string }> = [
	{ id: 'basics', label: 'Основа', hint: 'Название, формат и слоты' },
	{ id: 'schedule', label: 'Расписание', hint: 'Старт и окно чек-ина' },
	{ id: 'prize', label: 'Приз', hint: 'Фонд и эскроу с баланса' },
	{ id: 'broadcast', label: 'Эфир', hint: 'Стол и Dota TV' },
	{ id: 'review', label: 'Проверка', hint: 'Правила и публикация' }
];

export type TournamentCreateDraft = {
	title: string;
	description: string;
	format: 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION';
	maxTeams: '8' | '16' | '32';
	seriesRules: string;
	region: string;
	rankCap: string;
	prizePool: string;
	startAt: string;
	checkInOpensAt: string;
	checkInClosesAt: string;
	rules: string;
	twitchChannel: string;
	twitchSecondary: string;
	youtubeUrl: string;
	youtubeSecondaryUrl: string;
	dotaTv: string;
	lobbyName: string;
	delaySec: string;
	overlayTitle: string;
	inviteOnly: boolean;
	aegisAward: AegisAwardId;
	awardTouched: boolean;
	step: TournamentCreateWizardStep;
	savedAt: string;
};

export const emptyTournamentCreateDraft = (): Omit<TournamentCreateDraft, 'savedAt'> => ({
	title: '',
	description: '',
	format: 'SINGLE_ELIMINATION',
	maxTeams: '8',
	seriesRules: 'BO1',
	region: '',
	rankCap: '',
	prizePool: '0',
	startAt: '',
	checkInOpensAt: '',
	checkInClosesAt: '',
	rules: '',
	twitchChannel: '',
	twitchSecondary: '',
	youtubeUrl: '',
	youtubeSecondaryUrl: '',
	dotaTv: '',
	lobbyName: '',
	delaySec: '0',
	overlayTitle: '',
	inviteOnly: false,
	aegisAward: 'ember',
	awardTouched: false,
	step: 'basics'
});

export function parseTournamentCreateDraft(raw: unknown): TournamentCreateDraft | null {
	if (!raw || typeof raw !== 'object') return null;
	const row = raw as Partial<TournamentCreateDraft>;
	const base = emptyTournamentCreateDraft();
	const step = TOURNAMENT_CREATE_STEPS.some((item) => item.id === row.step) ? (row.step as TournamentCreateWizardStep) : 'basics';
	return {
		...base,
		title: typeof row.title === 'string' ? row.title : '',
		description: typeof row.description === 'string' ? row.description : '',
		format: row.format === 'DOUBLE_ELIMINATION' ? 'DOUBLE_ELIMINATION' : 'SINGLE_ELIMINATION',
		maxTeams: row.maxTeams === '16' || row.maxTeams === '32' ? row.maxTeams : '8',
		seriesRules: typeof row.seriesRules === 'string' ? row.seriesRules : 'BO1',
		region: typeof row.region === 'string' ? row.region : '',
		rankCap: typeof row.rankCap === 'string' ? row.rankCap : '',
		prizePool: typeof row.prizePool === 'string' ? row.prizePool : '0',
		startAt: typeof row.startAt === 'string' ? row.startAt : '',
		checkInOpensAt: typeof row.checkInOpensAt === 'string' ? row.checkInOpensAt : '',
		checkInClosesAt: typeof row.checkInClosesAt === 'string' ? row.checkInClosesAt : '',
		rules: typeof row.rules === 'string' ? row.rules : '',
		twitchChannel: typeof row.twitchChannel === 'string' ? row.twitchChannel : '',
		twitchSecondary: typeof row.twitchSecondary === 'string' ? row.twitchSecondary : '',
		youtubeUrl: typeof row.youtubeUrl === 'string' ? row.youtubeUrl : '',
		youtubeSecondaryUrl: typeof row.youtubeSecondaryUrl === 'string' ? row.youtubeSecondaryUrl : '',
		dotaTv: typeof row.dotaTv === 'string' ? row.dotaTv : '',
		lobbyName: typeof row.lobbyName === 'string' ? row.lobbyName : '',
		delaySec: typeof row.delaySec === 'string' ? row.delaySec : '0',
		overlayTitle: typeof row.overlayTitle === 'string' ? row.overlayTitle : '',
		inviteOnly: Boolean(row.inviteOnly),
		aegisAward: (row.aegisAward as AegisAwardId) || 'ember',
		awardTouched: Boolean(row.awardTouched),
		step,
		savedAt: typeof row.savedAt === 'string' ? row.savedAt : new Date(0).toISOString()
	};
}

export function validateTournamentCreateStep(
	step: TournamentCreateWizardStep,
	draft: Pick<TournamentCreateDraft, 'title' | 'startAt' | 'prizePool' | 'seriesRules'>
): string | null {
	if (step === 'basics') {
		if (draft.title.trim().length < 3) return 'Название — минимум 3 символа';
		if (!draft.seriesRules.trim()) return 'Укажите серию (BO1 / BO3)';
		return null;
	}
	if (step === 'schedule') {
		if (!draft.startAt) return 'Укажите дату старта';
		const start = new Date(draft.startAt);
		if (Number.isNaN(start.getTime())) return 'Некорректная дата старта';
		return null;
	}
	if (step === 'prize') {
		const rub = Number(draft.prizePool || 0);
		if (!Number.isFinite(rub) || rub < 0) return 'Приз не может быть отрицательным';
		return null;
	}
	return null;
}

export function nextTournamentCreateStep(step: TournamentCreateWizardStep): TournamentCreateWizardStep | null {
	const index = TOURNAMENT_CREATE_STEPS.findIndex((row) => row.id === step);
	if (index < 0 || index >= TOURNAMENT_CREATE_STEPS.length - 1) return null;
	return TOURNAMENT_CREATE_STEPS[index + 1]!.id;
}

export function prevTournamentCreateStep(step: TournamentCreateWizardStep): TournamentCreateWizardStep | null {
	const index = TOURNAMENT_CREATE_STEPS.findIndex((row) => row.id === step);
	if (index <= 0) return null;
	return TOURNAMENT_CREATE_STEPS[index - 1]!.id;
}

/** Live preview of 70/30 split and wallet shortfall while drafting a cup. */
export function previewCreatePrize(prizePoolRub: number, walletBalanceKopecks: number) {
	const prizePool = Math.max(0, Math.round(prizePoolRub * 100));
	const wallet = describeEscrowWallet({ prizePool, balance: walletBalanceKopecks });
	const lines = defaultPlaceSplit(prizePool).map((row) => ({
		place: row.place,
		amountLabel: formatPrizeAmount(row.amount),
		shareLabel: row.place === 1 ? '70%' : '30%'
	}));
	return {
		prizePool,
		prizeLabel: formatPrizeAmount(prizePool),
		lines,
		wallet,
		opensAsDraft: prizePool > 0,
		hint:
			prizePool <= 0
				? 'Без фонда кубок сразу откроет регистрацию.'
				: wallet.shortfall > 0
					? `Черновик с призом. Не хватает ${wallet.shortfallLabel} на кошельке — эскроу после пополнения.`
					: 'Черновик с призом. После сохранения зарезервируйте фонд ключом выплаты.'
	};
}

/** Compact mobile escrow strip copy from payout preview fields. */
export function escrowPayoutStrip(input: {
	totalLabel: string;
	escrowReady: boolean;
	canReserve: boolean;
	canPay: boolean;
	alreadyPaid: boolean;
	wallet: { haveLabel: string; neededLabel: string; shortfall: number; shortfallLabel: string; canAfford: boolean };
	hint: string;
}) {
	let status = 'Фонд';
	let tone: 'muted' | 'warn' | 'ok' | 'ready' = 'muted';
	if (input.alreadyPaid) {
		status = 'Выплачено';
		tone = 'ok';
	} else if (input.canPay) {
		status = 'Готово к выплате';
		tone = 'ready';
	} else if (input.escrowReady) {
		status = 'На эскроу';
		tone = 'ok';
	} else if (input.canReserve) {
		status = input.wallet.shortfall > 0 ? `Не хватает ${input.wallet.shortfallLabel}` : 'Ждёт эскроу';
		tone = input.wallet.shortfall > 0 ? 'warn' : 'ready';
	}
	return {
		status,
		tone,
		totalLabel: input.totalLabel,
		walletLine: `Кошелёк ${input.wallet.haveLabel} · нужно ${input.wallet.neededLabel}`,
		hint: input.hint
	};
}
