import { SITE_NAME, SITE_TAGLINE, absoluteUrl, defaultDescription } from '@/lib/site';

export function organizationJsonLd() {
	return {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: SITE_NAME,
		url: absoluteUrl('/'),
		description: defaultDescription,
		slogan: SITE_TAGLINE,
		disambiguatingDescription:
			'Независимая платформа сообщества. Не является официальным сервисом Valve, Dota 2 или Steam.'
	};
}

export function websiteJsonLd() {
	return {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: SITE_NAME,
		url: absoluteUrl('/'),
		inLanguage: 'ru-RU',
		description: defaultDescription,
		potentialAction: {
			'@type': 'SearchAction',
			target: `${absoluteUrl('/players')}?q={search_term_string}`,
			'query-input': 'required name=search_term_string'
		}
	};
}

export function softwareJsonLd() {
	return {
		'@context': 'https://schema.org',
		'@type': 'SoftwareApplication',
		name: SITE_NAME,
		applicationCategory: 'GameApplication',
		operatingSystem: 'Web',
		url: absoluteUrl('/'),
		description: defaultDescription,
		offers: {
			'@type': 'Offer',
			price: '0',
			priceCurrency: 'RUB'
		}
	};
}

export function faqJsonLd(items: Array<{ q: string; a: string }>) {
	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: items.map((item) => ({
			'@type': 'Question',
			name: item.q,
			acceptedAnswer: { '@type': 'Answer', text: item.a }
		}))
	};
}

export const arenaFaq: Array<{ q: string; a: string }> = [
	{
		q: 'Что такое Aegis Arena?',
		a: 'Aegis Arena — независимая веб-платформа сообщества для турниров пятёрок Dota 2. Игрок входит через Steam OpenID, собирает состав, заявляет команду на кубок и играет пары на арене. Это не клиент Dota 2 и не сервис Valve.'
	},
	{
		q: 'Как работает рейтинг арены?',
		a: 'Рейтинг арены считается только из закрытых пар турнира: +16 за победу и −12 за поражение. Пока игр нет, в карточке написано «нет игр». Это не MMR Valve и не медаль OpenDota.'
	},
	{
		q: 'Когда приз считается настоящим?',
		a: 'Сумма на карточке — ещё не деньги. Фонд настоящий только со статусом «зарезервирован / на эскроу». Если статус NONE или «не зарезервирован», выплаты нет. Сайт не рисует подтверждённый приз.'
	},
	{
		q: 'Что такое кубок на карточке игрока?',
		a: 'Кубок появляется только после завершённого финала с победителем. На карточке игрока это ссылка на страницу чемпионов. Сетка судьи и записи пар живут на карточке турнира.'
	},
	{
		q: 'Какие эгиды есть и как их взять?',
		a: 'Четыре модели: огонь — открытый кубок, ночная — старт с 22:00 до 06:00 МСК, пустоты — закрытый инвайт, реликт — двойное выбывание или BO3/BO5. Эгиду получает только чемпион финала. Финалисту вторую не ставим. Приз на эскроу — отдельно.'
	},
	{
		q: 'Связана ли Aegis Arena с Valve?',
		a: 'Нет. Aegis Arena — независимый проект сообщества. Dota 2, Steam и связанные знаки — товарные знаки Valve Corporation. Платформа не одобрена Valve.'
	}
];
