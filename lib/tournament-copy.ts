export const tournamentStatusCopy: Record<string, { label: string; hint: string; tone: 'radiant' | 'info' | 'aegis' | 'muted' | 'dire' | 'wait' }> = {
	DRAFT: { label: 'Черновик', hint: 'Виден только организатору. После публикации откроется регистрация.', tone: 'muted' },
	REGISTRATION: { label: 'Регистрация', hint: 'Капитаны заявляют пятёрки. Организатор принимает или отклоняет заявки.', tone: 'radiant' },
	CHECK_IN: { label: 'Отметка состава', hint: 'Одобренные капитаны подтверждают, что команда на месте.', tone: 'info' },
	LIVE: { label: 'Идёт', hint: 'Сетка собрана. До старта команды ждут день турнира, затем подтверждают готовность.', tone: 'aegis' },
	FINISHED: { label: 'Завершён', hint: 'Все матчи закрыты. Можно выплатить призы.', tone: 'muted' },
	CANCELLED: { label: 'Отменён', hint: 'Турнир остановлен организатором.', tone: 'dire' }
};

export const applicationStatusCopy: Record<string, { label: string; hint: string }> = {
	DRAFT: { label: 'Черновик заявки', hint: 'Заявка ещё не отправлена организатору.' },
	SUBMITTED: { label: 'Ждёт решения', hint: 'Капитан подал состав. Организатор ещё не ответил.' },
	NEEDS_ACTION: { label: 'Нужно действие', hint: 'Организатор просит поправить состав или данные.' },
	APPROVED: { label: 'Принята', hint: 'Команда в турнире. Дальше — отметка состава и день старта.' },
	CHECKED_IN: { label: 'Состав отмечен', hint: 'Капитан подтвердил явку. До старта команда ждёт день турнира.' },
	IN_BRACKET: { label: 'В сетке', hint: 'Пара уже есть в таблице. Готовность подтверждают в день турнира.' },
	REJECTED: { label: 'Отклонена', hint: 'Организатор не принял заявку.' },
	WITHDRAWN: { label: 'Снята', hint: 'Капитан сам отозвал команду.' },
	NO_CHECK_IN: { label: 'Не отметились', hint: 'Окно отметки закрылось без подтверждения капитана.' },
	DISQUALIFIED: { label: 'Дисквалификация', hint: 'Команда снята судьёй.' },
	WAITLIST: { label: 'Лист ожидания', hint: 'Слотов нет. Организатор поднимет, если кто-то снимется до сетки.' }
};

export const matchStatusCopy: Record<string, string> = {
	PENDING: 'Ожидает соперника',
	SCHEDULED: 'Назначен',
	LIVE: 'Идёт матч',
	NEEDS_REVIEW: 'Спор по счёту',
	COMPLETED: 'Завершён',
	TECHNICAL: 'Технический результат'
};

export const formatCopy: Record<string, string> = {
	SINGLE_ELIMINATION: 'Олимпийка',
	DOUBLE_ELIMINATION: 'Двойное выбывание'
};

export const bracketCopy: Record<string, string> = {
	winners: 'Верхняя сетка',
	losers: 'Нижняя сетка',
	grand: 'Гранд-финал',
	preview: 'Предпросмотр пар'
};

export type ReadyStatus = 'PENDING' | 'READY' | 'DECLINED';

export function applicationStatusLabel(status: string) {
	return applicationStatusCopy[status]?.label ?? status;
}

export function applicationStatusHint(status: string) {
	return applicationStatusCopy[status]?.hint ?? '';
}

export function tournamentStatusLabel(status: string) {
	return tournamentStatusCopy[status]?.label ?? status;
}
