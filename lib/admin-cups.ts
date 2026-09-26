import { describeEscrowWallet } from '@/lib/prize-places';

export const ADMIN_CUP_STATUSES = ['DRAFT', 'REGISTRATION', 'CHECK_IN', 'LIVE', 'FINISHED', 'CANCELLED'] as const;
export type AdminCupStatus = (typeof ADMIN_CUP_STATUSES)[number];

const SEATED = new Set(['APPROVED', 'CHECKED_IN', 'IN_BRACKET']);
const OPEN_FOR_SLOTS = new Set(['REGISTRATION', 'CHECK_IN']);
const NEEDS_WINDOW = new Set(['REGISTRATION', 'CHECK_IN', 'LIVE']);

export type AdminCupGap = {
	id: string;
	label: string;
	hint: string;
	tone: 'alert' | 'soft';
};

export type AdminCupInput = {
	description?: string | null;
	rules?: string | null;
	region?: string | null;
	status: string;
	maxTeams: number;
	prizePool: number;
	prizeCurrency?: string | null;
	prizeStatus: string;
	checkInOpensAt?: string | null;
	checkInClosesAt?: string | null;
	createdById?: string | null;
	ownerTotp?: boolean;
	ownerBalance?: number;
	matches: number;
	applicationStatuses: string[];
};

export function isAdminCupStatus(value: string | null): value is AdminCupStatus {
	return ADMIN_CUP_STATUSES.some((status) => status === value);
}

export function readableCupCopy(value: string | null | undefined) {
	const text = value?.replace(/\s+/g, ' ').trim() ?? '';
	if (!text) return null;
	const marks = text.split('?').length - 1;
	if (marks >= 4 && marks / text.length > 0.2) return null;
	return text;
}

export function adminCupFill(statuses: string[], maxTeams: number) {
	const seated = statuses.filter((status) => SEATED.has(status)).length;
	const pending = statuses.filter((status) => status === 'SUBMITTED' || status === 'NEEDS_ACTION').length;
	const missed = statuses.filter((status) => status === 'NO_CHECK_IN').length;
	const waitingCheckIn = statuses.filter((status) => status === 'APPROVED').length;
	const cap = Math.max(0, maxTeams);
	return {
		seated,
		pending,
		missed,
		waitingCheckIn,
		maxTeams: cap,
		ratio: cap > 0 ? Math.min(1, seated / cap) : 0
	};
}

export function adminCupGaps(cup: AdminCupInput): AdminCupGap[] {
	const gaps: AdminCupGap[] = [];
	const closed = cup.status === 'FINISHED' || cup.status === 'CANCELLED';

	if (!readableCupCopy(cup.description)) {
		gaps.push({ id: 'description', label: 'Нет описания', hint: 'На карточке кубка пустой текст', tone: 'soft' });
	}
	if (!readableCupCopy(cup.rules)) {
		gaps.push({ id: 'rules', label: 'Нет правил', hint: 'Регламент игрокам не показан', tone: 'soft' });
	}
	if (!readableCupCopy(cup.region)) {
		gaps.push({ id: 'region', label: 'Нет региона', hint: 'Регион в карточке не указан', tone: 'soft' });
	}
	if (!cup.createdById) {
		gaps.push({ id: 'owner', label: 'Нет орга', hint: 'Кубок ни на кого не повешен', tone: 'alert' });
	}

	if (cup.prizePool > 0 && cup.prizeStatus !== 'CONFIRMED' && cup.prizeStatus !== 'NONE') {
		const wallet = describeEscrowWallet({
			prizePool: cup.prizePool,
			balance: cup.ownerBalance ?? 0,
			currency: cup.prizeCurrency ?? 'RUB'
		});
		gaps.push(
			wallet.shortfall > 0
				? {
						id: 'escrow',
						label: `Не хватает ${wallet.shortfallLabel}`,
						hint: 'Фонд объявлен, на кошельке орга этих денег нет',
						tone: 'alert'
					}
				: {
						id: 'escrow',
						label: 'Эскроу не списан',
						hint: 'Денег на кошельке хватает, резерв ещё не списан',
						tone: 'alert'
					}
		);
		if (cup.createdById && !cup.ownerTotp) {
			gaps.push({
				id: 'totp',
				label: 'Нет ключа выплаты',
				hint: 'Без ключа живой резерв не спишется',
				tone: 'alert'
			});
		}
	}

	if (!closed && NEEDS_WINDOW.has(cup.status) && !cup.checkInOpensAt && !cup.checkInClosesAt) {
		gaps.push({ id: 'window', label: 'Нет окна отметки', hint: 'Время чек-ина не задано', tone: 'soft' });
	}

	const fill = adminCupFill(cup.applicationStatuses, cup.maxTeams);
	if (OPEN_FOR_SLOTS.has(cup.status) && fill.maxTeams > 0 && fill.seated < fill.maxTeams) {
		gaps.push({
			id: 'slots',
			label: `Слоты ${fill.seated} из ${fill.maxTeams}`,
			hint: 'Принятых команд меньше лимита',
			tone: 'soft'
		});
	}
	if (cup.status === 'CHECK_IN' && fill.waitingCheckIn > 0) {
		gaps.push({
			id: 'checkin',
			label: `Не отметились ${fill.waitingCheckIn}`,
			hint: 'Принятые команды ещё не подтвердили явку',
			tone: 'alert'
		});
	}
	if ((cup.status === 'LIVE' || cup.status === 'CHECK_IN') && cup.matches === 0) {
		gaps.push({ id: 'bracket', label: 'Нет сетки', hint: 'Пар в кубке ещё нет', tone: 'alert' });
	}

	return gaps;
}
