import Link from 'next/link';
import { SITE_NAME } from '@/lib/site';

const nav = [
	{ href: '#marks', label: 'Знаки' },
	{ href: '#materials', label: 'Материалы сети' },
	{ href: '#privacy', label: 'Приватность' },
	{ href: '#sessions', label: 'Сессии' },
	{ href: '#sources', label: 'Цифры' },
	{ href: '#report', label: 'Жалоба' },
	{ href: '#security', label: 'Безопасность' }
];

const materials = [
	{
		title: 'Dota 2, Steam, логотипы',
		from: 'Valve Corporation',
		rights: 'Товарные знаки и оформление принадлежат Valve. Мы называем игру, в которую играет сообщество. Это не лицензия и не партнёрство.'
	},
	{
		title: 'Портреты героев',
		from: 'Локальный кэш /heroes + Steam CDN fallback',
		rights: 'Картинки героев — объект прав Valve. Мы храним сжатые webp в /public/heroes для LCP; при отсутствии файла — CDN. Публичный адрес не делает арт нашим.'
	},
	{
		title: 'Иконки способностей (только recap)',
		from: 'Steam CDN abilities/…',
		rights: 'Показываем только на карточке после катки, если в payload матча есть ability ids. Не в каталоге героев, ready и live boards.'
	},
	{
		title: 'Медали ранга',
		from: 'Иконки OpenDota, цифра — API OpenDota',
		rights: 'Значок медали — оформление Valve. OpenDota только отдаёт его и rank tier, если профиль Steam открыт. Мы кэшируем, не рисуем.'
	},
	{
		title: 'MMR и матчи',
		from: 'api.opendota.com',
		rights: 'Исходные матчи стоят на стороне Valve. OpenDota собирает открытую статистику. Aegis Arena показывает кэш, не выдумывает MMR.'
	},
	{
		title: 'Ник и аватар',
		from: 'Steam OpenID и профиль Steam',
		rights: 'Лицо профиля — игрока и Steam. Мы берём SteamID, ник и аватар, чтобы узнать человека на арене. Пароль не приходит.'
	},
	{
		title: 'Команды, заявки, сетка',
		from: 'Этот сайт и участники',
		rights: 'Названия команд и тексты заявок — участников. Код, тексты арены, сетка и кубок после финала — ' + SITE_NAME + '.'
	},
	{
		title: 'Атмосфера десков',
		from: 'Wikimedia Commons CC0 / Public Domain',
		rights:
			'Фоны шапок — камень, гранит, бронза, дрова: CC0 или public domain. Это не арт Valve, не эгида The International и не портреты героев. Файлы лежат у нас в /atmosphere, не хотлинк.'
	}
];

export function LegalDesk() {
	return (
		<main className="mx-auto max-w-shell space-y-8 px-4 py-12 md:px-6 lg:px-10">
			<div>
				<p className="font-mono text-xs uppercase tracking-[0.22em] text-aegisSoft">Правовое</p>
				<h1 className="mt-3 font-display text-4xl text-cream md:text-5xl">Не Valve и не лицензия на Dota 2</h1>
				<p className="mt-4 max-w-3xl text-lg leading-7 text-muted">
					{SITE_NAME} — независимый сайт сообщества: пятёрка, кубок, рейтинг арены. Это не оферта Valve, не клиент
					Dota 2 и не разрешение пользоваться интеллектуальной собственностью Valve.
				</p>
				<p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
					Что лежит в открытом интернете, остаётся под правами своего разработчика и правообладателя. Открытая
					ссылка не передаёт нам эти права.
				</p>
			</div>

			<nav aria-label="Разделы" className="-mx-1 flex flex-wrap gap-2">
				{nav.map((item) => (
					<a
						key={item.href}
						href={item.href}
						className="inline-flex min-h-11 items-center rounded-full border border-line px-3 text-sm text-cream hover:border-aegis"
					>
						{item.label}
					</a>
				))}
			</nav>

			<section className="obsidian-glass scroll-mt-24 rounded-card p-5 md:p-6">
				<h2 className="font-display text-xl text-cream">Кто мы</h2>
				<p className="mt-3 text-sm leading-6 text-muted">
					Платформа для пятёрок сообщества. Мы не матчмейкинг Valve, не Steam, не Dota Plus и не магазин игр.
					Вход только через официальный Steam OpenID на <span className="text-cream">steamcommunity.com</span>.
					Пароль, Steam Guard и резервные коды сайт не спрашивает и не принимает.
				</p>
			</section>

			<section id="marks" className="obsidian-glass scroll-mt-24 rounded-card p-5 md:p-6">
				<h2 className="font-display text-xl text-cream">Товарные знаки</h2>
				<p className="mt-3 text-sm leading-6 text-muted">
					Dota, Dota 2, Steam, Valve и связанные логотипы — товарные знаки Valve Corporation. {SITE_NAME} не связан
					с Valve, не спонсируется и не одобрен ею. Упоминание нужно, чтобы игрок понял, про какую игру речь.
					Это не лицензия на клиент, сервера, предметы, звук, музыку или арт Valve.
				</p>
			</section>

			<section id="materials" className="scroll-mt-24 space-y-4">
				<div>
					<h2 className="font-display text-2xl text-cream">Открытые материалы сети</h2>
					<p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
						Мы показываем публичные идентификаторы и открытые API. Права на них не переходят на арену и не
						становятся «общественным достоянием» только потому, что файл открывается в браузере. Защищены
						правами своих разработчиков и правообладателей.
					</p>
				</div>
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
					{materials.map((item) => (
						<article key={item.title} className="obsidian-glass rounded-card p-5">
							<h3 className="font-display text-cream">{item.title}</h3>
							<p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-aegisSoft">{item.from}</p>
							<p className="mt-2 text-sm leading-6 text-muted">{item.rights}</p>
						</article>
					))}
				</div>
			</section>

			<section className="obsidian-glass scroll-mt-24 rounded-card p-5 md:p-6">
				<h2 className="font-display text-xl text-cream">Что принадлежит арене</h2>
				<p className="mt-3 text-sm leading-6 text-muted">
					Код сайта, свои тексты, интерфейс, сетка кубка, витринный кубок после финала и рейтинг арены +16 / −12 —
					это {SITE_NAME}. Рейтинг арены считается только из закрытых пар здесь. Это не MMR Valve и не медаль
					OpenDota.
					Названия чужих команд и чужие заявки мы не присваиваем.
				</p>
			</section>

			<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
				<section id="privacy" className="obsidian-glass scroll-mt-24 rounded-card p-5 md:p-6">
					<h2 className="font-display text-xl text-cream">Приватность</h2>
					<p className="mt-3 text-sm leading-6 text-muted">
						После входа храним SteamID, ник, аватар и то, что вы делаете на арене: команда, заявки, пары, сессия.
						Медаль и MMR подтягиваем с OpenDota, только если профиль Steam открыт. Закрытый профиль честно
						показывается без цифры. Пароль Steam сюда не попадает.
					</p>
				</section>
				<section id="sessions" className="obsidian-glass scroll-mt-24 rounded-card p-5 md:p-6">
					<h2 className="font-display text-xl text-cream">Сессии</h2>
					<p className="mt-3 text-sm leading-6 text-muted">
						Сессия — cookie <span className="text-cream">aegis_session</span>: HttpOnly, SameSite=Lax, Secure на
						боевом стенде, до 14 дней. Не кладём токен в localStorage. Список устройств и выход — в своём
						профиле после входа.
					</p>
				</section>
			</div>

			<section id="sources" className="obsidian-glass scroll-mt-24 rounded-card p-5 md:p-6">
				<h2 className="font-display text-xl text-cream">Откуда цифры</h2>
				<ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
					<li>
						<span className="text-cream">Рейтинг арены</span> — только закрытая пара турнира: +16 победа, −12
						поражение. Нет игр — «нет игр».
					</li>
					<li>
						<span className="text-cream">«На арене»</span> — заход на сайт за 15 минут, не онлайн клиента Dota.
					</li>
					<li>
						<span className="text-cream">MMR и медаль</span> — кэш OpenDota по открытому профилю, не оценка арены.
					</li>
					<li>
						<span className="text-cream">Приз</span> — настоящий только при статусе эскроу CONFIRMED. ZERO / NONE /
						витринный кубок с нулём — не выплата.
					</li>
					<li>
						<span className="text-cream">Кубок на карточке</span> — только после завершённого финала с победителем.
					</li>
					<li>
						<span className="text-cream">Фоны шапок</span> — текстуры CC0 / public domain (камень, гранит, бронза,
						дрова). Не арт Valve и не кубок TI.
					</li>
				</ul>
			</section>

			<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
				<section id="report" className="obsidian-glass scroll-mt-24 rounded-card p-5 md:p-6">
					<h2 className="font-display text-xl text-cream">Пожаловаться</h2>
					<p className="mt-3 text-sm leading-6 text-muted">
						Спор по счёту пары — через форму спора на странице матча (оба капитана). Нарушение правил кубка,
						токсичность или подозрение на сговор — пишите организатору турнира в его канале или через заявку на
						карточке кубка. Для платформы в целом: раздел «Безопасность» ниже и контакты на{' '}
						<Link href="/about" className="text-aegisSoft hover:text-aegis">
							странице об арене
						</Link>
						.
					</p>
				</section>
				<section id="security" className="obsidian-glass scroll-mt-24 rounded-card p-5 md:p-6">
					<h2 className="font-display text-xl text-cream">Безопасность</h2>
					<p className="mt-3 text-sm leading-6 text-muted">
						Мутации с вашего браузера идут только с того же origin; чувствительные действия — с Idempotency-Key и
						лимитами. Выплаты приза — после подтверждённого эскроу и (где включено) TOTP организатора. Пароль
						Steam на арену не передаётся: вход только через Steam OpenID. Не делитесь ссылками с cookie и не
						входите с чужих устройств без выхода из профиля.
					</p>
				</section>
			</div>

			<section className="rounded-card border border-line/70 bg-panel/40 p-5 md:p-6">
				<h2 className="font-display text-xl text-cream">Это не договор и не консультация</h2>
				<p className="mt-3 text-sm leading-6 text-muted">
					Страница объясняет, чем арена не является и чьи права на чужие знаки и файлы. Это не публичная оферта
					Valve, не оферта на выплату приза и не юридическая консультация. Правила конкретного кубка — на карточке
					турнира. Текст обновлён 19 сентября 2026.
				</p>
			</section>

			<p className="text-sm text-muted">
				<Link href="/about" className="text-aegisSoft hover:text-aegis">
					Как устроена арена
				</Link>
				{' · '}
				<Link href="/tournaments" className="text-aegisSoft hover:text-aegis">
					Турниры
				</Link>
				{' · '}
				<Link href="/llms.txt" className="text-aegisSoft hover:text-aegis">
					Для ИИ
				</Link>
			</p>
		</main>
	);
}
