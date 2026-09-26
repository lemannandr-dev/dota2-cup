export const adminRoleCopy: Record<string, string> = {
	USER: 'Игрок',
	GAMER: 'Геймер',
	ORGANIZER: 'Организатор',
	ADMIN: 'Админ стенда'
};

export const adminPrizeStatusCopy: Record<string, string> = {
	NONE: 'без фонда',
	UNCONFIRMED: 'не зарезервирован',
	CONFIRMED: 'на эскроу'
};

export const adminTxTypeCopy: Record<string, string> = {
	DEPOSIT: 'пополнение',
	WITHDRAW: 'списание',
	BONUS: 'бонус',
	EARNED: 'выплата',
	SPENT: 'эскроу',
	REFUND: 'возврат',
	PENALTY: 'штраф'
};

export const adminEntityCopy: Record<string, string> = {
	SiteAppearance: 'оформление',
	User: 'игрок',
	Tournament: 'кубок',
	Team: 'команда',
	TeamApplication: 'заявка',
	TeamInvite: 'приглашение',
	Dispute: 'спор',
	Match: 'пара'
};

export const adminAuditCopy: Record<string, string> = {
	SITE_APPEARANCE_UPDATED: 'Оформление опубликовано',
	SITE_APPEARANCE_RESET: 'Стандартное оформление восстановлено',
	SITE_APPEARANCE_IMAGE_UPLOADED: 'Изображение оформления загружено',
	STAND_ADMIN_GRANTED: 'Выдан доступ в админку стенда',
	TOURNAMENT_OWNER_CLAIMED: 'Кубок повешен на организатора',
	PRIZE_PAID: 'Приз выплачен капитану',
	ROLE_CHANGED: 'Смена роли',
	USER_DELETED: 'Аккаунт удалён',
	BALANCE_ADJUST: 'Правка баланса',
	TEAM_SOFT_DELETED: 'Команда скрыта',
	TEAM_CREATED: 'Команда создана',
	TEAM_UPDATED: 'Команда изменена',
	TEAM_LEFT: 'Игрок вышел из команды',
	TEAM_KICKED: 'Игрок исключён из команды',
	TEAM_SUBSTITUTE: 'Запасной в составе',
	TEAM_REGISTERED: 'Команда заявлена на кубок',
	TEAM_WITHDRAWN: 'Заявка отозвана',
	TEAM_CHECKED_IN: 'Состав отметился',
	TEAM_INVITE_CREATED: 'Отправлено приглашение',
	PARTY_CREATED: 'Создано пати',
	PARTY_LINK_CREATED: 'Создана ссылка приглашения в пати',
	PARTY_LINKS_REVOKED: 'Ссылки пати отозваны',
	PARTY_MEMBER_KICK: 'Лидер исключил игрока из пати',
	PARTY_MEMBER_LEAVE: 'Игрок вышел из пати',
	PARTY_MEMBER_SUBSTITUTE: 'Изменён основной состав пати',
	PARTY_MEMBER_DEPUTY: 'Назначен заместитель лидера',
	TEAM_CHALLENGE_CREATED: 'Отправлен вызов',
	TOURNAMENT_CREATED: 'Кубок создан',
	TOURNAMENT_PUBLISHED: 'Кубок опубликован',
	TOURNAMENT_STATUS_CHANGED: 'Смена статуса кубка',
	TOURNAMENT_ADMIN_PATCH: 'Кубок изменён из админки',
	TOURNAMENT_CANCELLED: 'Кубок отменён',
	TOURNAMENT_CANCELLED_NO_TEAMS: 'Кубок отменён: мало отметившихся',
	BRACKET_GENERATED: 'Сетка собрана',
	APPLICATION_REVIEWED: 'Заявка рассмотрена',
	STAFF_ASSIGNED: 'Назначен судья',
	STAFF_REMOVED: 'Судья снят',
	ROSTER_SWAPPED: 'Замена в составе',
	MATCH_RESULT_REPORTED: 'Сдан счёт пары',
	MATCH_NO_SHOW_DEADLINE: 'Техпоражение по дедлайну',
	MATCH_NO_SHOW_STAFF: 'Неявка зафиксирована судьёй',
	DISPUTE_OPENED: 'Открыт спор',
	DISPUTE_RESOLVED: 'Спор закрыт',
	DISPUTE_EVIDENCE_ADDED: 'К спору добавлено доказательство',
	STEAM_LOGIN_SUCCEEDED: 'Вход через Steam',
	MATCH_ADMIN_PATCH: 'Статус пары изменён из админки',
	TOTP_RESET: 'Сброшен ключ выплаты',
	DISPUTE_REVIEW: 'Спор взят на разбор',
	DISPUTE_REJECTED: 'Спор отклонён без счёта',
	ADMIN_TOPUP_REQUEST: 'Заявка на пополнение кошелька',
	TOURNAMENT_EDITED: 'Черновик кубка изменён',
	TOURNAMENT_CLONED: 'Кубок скопирован в черновик',
	PRIZE_ESCROW_RELEASED: 'Эскроу возвращён на кошелёк орга',
	WAITLIST_JOINED: 'Команда в листе ожидания',
	WAITLIST_PROMOTED: 'Команда поднята из листа ожидания',
	TEAM_DEPUTY_SET: 'Назначен заместитель капитана'
};

export function adminLabel(map: Record<string, string>, value: string | null | undefined) {
	if (!value) return '—';
	return map[value] ?? value;
}

export function adminRoleLabel(role: string) {
	return adminLabel(adminRoleCopy, role);
}

export function adminPrizeStatusLabel(status: string) {
	return adminLabel(adminPrizeStatusCopy, status);
}

export function adminTxTypeLabel(type: string) {
	return adminLabel(adminTxTypeCopy, type);
}

export function adminEntityLabel(entity: string) {
	return adminLabel(adminEntityCopy, entity);
}

export function adminAuditLabel(action: string) {
	return adminLabel(adminAuditCopy, action);
}
