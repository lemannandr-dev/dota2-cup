import { arenaFaq } from '@/lib/seo-jsonld';

const steps = [
	{
		title: 'Вход через Steam',
		text: 'Открывается steamcommunity.com. Aegis Arena получает SteamID, ник и аватар. Пароль и Steam Guard остаются в Steam.'
	},
	{
		title: 'Пятёрка',
		text: 'Капитан собирает состав. В сетку идут игроки с привязанным Steam. «Онлайн» на арене — заход на сайт за 15 минут, не клиент Dota.'
	},
	{
		title: 'Кубок',
		text: 'Регистрация → отметка состава → день старта → «я готов» → пары. Счёт пишет капитан или судья. Споры живут на карточке турнира.'
	},
	{
		title: 'После финала',
		text: 'Победитель получает кубок на карточках игроков и команд. Рейтинг арены: +16 / −12 только из закрытой пары. Приз — только с эскроу.'
	}
];

export function HowArenaWorks() {
	return (
		<section id="about-arena" className="max-w-shell mx-auto scroll-mt-20 px-4 py-20 md:px-6 md:py-28 lg:px-10">
			<p className="mb-4 font-mono text-xs tracking-[0.3em] text-aegis">КАК УСТРОЕНА АРЕНА</p>
			<h2 className="font-display text-3xl font-bold uppercase leading-tight text-cream md:text-5xl">
				Платформа для пятёрок,
				<br />
				не клиент Dota 2
			</h2>
			<p className="mt-4 max-w-3xl text-lg leading-7 text-muted">
				Aegis Arena — независимый сайт сообщества: собрать пятёрку, заявить её на турнир, сыграть сетку и увидеть
				кубок после финала. Мы не подменяем матчмейкинг Valve, не рисуем MMR и не называем незарезервированный фонд
				«подтверждённым призом».
			</p>

			<div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
				{steps.map((step, index) => (
					<article key={step.title} className="obsidian-glass rounded-card p-5">
						<p className="font-mono text-[11px] uppercase tracking-[0.18em] text-aegisSoft">Шаг {index + 1}</p>
						<h3 className="mt-2 font-display text-xl text-cream">{step.title}</h3>
						<p className="mt-2 text-sm leading-6 text-muted">{step.text}</p>
					</article>
				))}
			</div>

			<section className="mt-12">
				<h3 className="font-display text-2xl text-cream">Частые вопросы</h3>
				<dl className="mt-5 space-y-3">
					{arenaFaq.map((item) => (
						<div key={item.q} className="obsidian-glass rounded-card p-5">
							<dt className="font-display text-cream">{item.q}</dt>
							<dd className="mt-2 text-sm leading-6 text-muted">{item.a}</dd>
						</div>
					))}
				</dl>
			</section>
		</section>
	);
}
