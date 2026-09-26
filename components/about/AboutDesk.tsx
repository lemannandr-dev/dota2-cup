import Link from 'next/link';
import { CupGlyph } from '@/components/cups/DotaTrophy3D';
import { AboutBracket } from '@/components/about/AboutBracket';
import { AtmosphereWash } from '@/components/desk/AtmosphereWash';
import { AEGIS_AWARDS, type AegisAwardDef } from '@/lib/aegis-awards';
import type { AboutBracketStory, AboutCupCard } from '@/lib/about-arena';
import { arenaFaq } from '@/lib/seo-jsonld';

const steps = [
	{ title: 'Steam', text: 'Вход на steamcommunity.com. Пароль остаётся в Steam.' },
	{ title: 'Пятёрка', text: 'Капитан собирает состав со Steam. Онлайн арены — заход на сайт за 15 минут.' },
	{ title: 'Сетка', text: 'Заявка → отметка → пары. Счёт пишет капитан, соперник принимает.' },
	{ title: 'Кубок', text: 'После финала модель встаёт на карточки чемпионов. Приз — только эскроу.' }
];

function AwardCard({ award }: { award: AegisAwardDef }) {
	return (
		<article className="obsidian-glass flex h-full flex-col rounded-card p-4">
			<div className="mx-auto h-44 w-32">
				<CupGlyph
					year={2026}
					title={award.name}
					accent={award.id}
					subtitle={award.plaque}
					caption={award.caption}
					className="h-full w-full"
				/>
			</div>
			<h3 className="mt-3 font-display text-cream">{award.name}</h3>
			<p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-aegisSoft">{award.who}</p>
			<p className="mt-2 text-sm leading-6 text-muted">{award.how}</p>
			<p className="mt-2 text-xs leading-5 text-muted">{award.hint}</p>
		</article>
	);
}

function CupCard({ cup }: { cup: AboutCupCard }) {
	return (
		<a href={cup.href} className="obsidian-glass flex flex-col rounded-card p-4 hover:ring-1 hover:ring-aegis/35">
			{cup.awarded && cup.trophy ? (
				<div className="mx-auto h-44 w-32">
					<CupGlyph
						year={cup.trophy.year}
						title={cup.title}
						accent={cup.award.id}
						subtitle={cup.award.plaque}
						caption={cup.award.caption}
						className="h-full w-full"
					/>
				</div>
			) : (
				<div className="flex h-28 flex-col items-center justify-center rounded-xl border border-dashed border-line px-3 text-center text-xs text-muted">
					<span>Модель после финала</span>
					<span className="mt-1 text-aegisSoft">чемпиону — {cup.award.name}</span>
				</div>
			)}
			<p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-aegisSoft">{cup.statusLabel}</p>
			<h3 className="mt-1 font-display text-cream">{cup.title}</h3>
			<p className="mt-1 text-xs leading-5 text-muted">
				{cup.formatLabel} · {cup.teams}/{cup.maxTeams} команд · {cup.prizeLabel}
			</p>
			{cup.championName && <p className="mt-1 text-sm text-[#E8D0B0]">Гравировка: {cup.championName}</p>}
			{cup.prizeHint && <p className="mt-1 text-[11px] text-muted">{cup.prizeHint}</p>}
		</a>
	);
}

export function AboutDesk({ cups, bracket }: { cups: AboutCupCard[]; bracket: AboutBracketStory }) {
	return (
		<main className="mx-auto max-w-shell space-y-10 px-4 py-12 md:px-6 lg:px-10">
			<header className="obsidian-glass relative overflow-hidden rounded-card p-5 md:p-6">
				<AtmosphereWash tone="stone" />
				<div className="relative">
					<p className="font-mono text-xs uppercase tracking-[0.22em] text-aegisSoft">Aegis Arena</p>
					<h1 className="mt-3 font-display text-4xl text-cream md:text-5xl">Пятёрка, сетка, кубок</h1>
					<p className="mt-4 max-w-2xl text-base leading-7 text-muted">
						Четыре эгиды в выдаче. Чемпион кубка получает ту модель, которую орг поставил на этот кубок. Финалисту
						вторую эгиду не даём. Деньги — только эскроу.
					</p>
					<nav aria-label="Разделы" className="mt-5 flex flex-wrap gap-2">
						{[
							['#path', 'Как идём'],
							['#bracket', 'Сетка'],
							['#cups', 'Кубки сегодня'],
							['#awards', 'Как взять эгиду']
						].map(([href, label]) => (
							<a
								key={href}
								href={href}
								className="inline-flex min-h-11 items-center rounded-full border border-line px-3 text-sm text-cream hover:border-aegis"
							>
								{label}
							</a>
						))}
					</nav>
				</div>
			</header>

			<section id="path" className="scroll-mt-24">
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{steps.map((step, index) => (
						<article key={step.title} className="obsidian-glass rounded-card p-4">
							<p className="font-mono text-[11px] text-aegisSoft">{index + 1}</p>
							<h2 className="mt-1 font-display text-lg text-cream">{step.title}</h2>
							<p className="mt-1 text-sm leading-6 text-muted">{step.text}</p>
						</article>
					))}
				</div>
			</section>

			<AboutBracket story={bracket} />

			<section id="cups" className="scroll-mt-24 space-y-4">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<div>
						<p className="font-mono text-[11px] uppercase tracking-[0.18em] text-aegisSoft">Сегодня на арене</p>
						<h2 className="mt-2 font-display text-2xl text-cream md:text-3xl">Какие кубки есть</h2>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
							Открытые показывают, какую эгиду получит чемпион. Закрытые с финалом — уже та модель на карточке.
						</p>
					</div>
					<Link href="/tournaments" className="text-sm text-aegisSoft hover:text-aegis">
						Весь каталог
					</Link>
				</div>
				{cups.length === 0 ? (
					<div className="obsidian-glass rounded-card p-5 text-sm text-muted">
						Сейчас нет опубликованных кубков. Когда орг откроет регистрацию, они появятся здесь и в каталоге.
					</div>
				) : (
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{cups.map((cup) => (
							<CupCard key={cup.id} cup={cup} />
						))}
					</div>
				)}
			</section>

			<section id="awards" className="scroll-mt-24 space-y-4">
				<div className="obsidian-glass relative overflow-hidden rounded-card p-4 md:p-5">
					<AtmosphereWash tone="void" />
					<div className="relative">
						<p className="font-mono text-[11px] uppercase tracking-[0.18em] text-aegisSoft">Как взять</p>
						<h2 className="mt-2 font-display text-2xl text-cream md:text-3xl">Четыре эгиды и путь к ним</h2>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
							Общий шаг один: выиграть финал своего кубка. Какая модель встанет — решает тип кубка, не случай и не
							покупка. Старые закрытые кубки остаются огнём.
						</p>
					</div>
				</div>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
					{AEGIS_AWARDS.map((award) => (
						<AwardCard key={award.id} award={award} />
					))}
				</div>
			</section>

			<section className="space-y-3">
				<h2 className="font-display text-xl text-cream">Коротко</h2>
				<dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
					{arenaFaq.map((item) => (
						<div key={item.q} className="obsidian-glass rounded-card p-4">
							<dt className="font-display text-cream">{item.q}</dt>
							<dd className="mt-2 text-sm leading-6 text-muted">{item.a}</dd>
						</div>
					))}
				</dl>
			</section>
		</main>
	);
}
