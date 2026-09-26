import { SteamButton } from '@/components/dota/SteamButton';
import Link from 'next/link';

export function AnalyticsSection() {
	return (
		<section id="analytics" className="max-w-shell mx-auto px-4 md:px-6 lg:px-10 py-20 md:py-28 scroll-mt-20">
			<p className="text-xs tracking-[0.3em] text-aegis font-mono mb-4">ЦИФРЫ БЕЗ ВЫДУМКИ</p>
			<h2 className="font-display font-bold uppercase text-3xl md:text-5xl text-cream leading-tight">
				Не мок win rate и не очки гильдии
			</h2>
			<p className="mt-4 text-muted max-w-2xl">
				На лендинге больше нет демо-графиков. Живые цифры появляются после входа — и только из своих источников.
			</p>
			<div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
				<Link href="/tournaments" className="obsidian-glass rounded-card p-5 hover:border-aegis/40">
					<div className="text-xs uppercase tracking-wide text-muted">Рейтинг арены</div>
					<p className="mt-2 text-sm text-cream">+16 победа / −12 поражение из пар турнира. Без игр — «нет игр».</p>
				</Link>
				<a href="/heroes" className="obsidian-glass rounded-card p-5 hover:border-aegis/40">
					<div className="text-xs uppercase tracking-wide text-muted">Dota Plus</div>
					<p className="mt-2 text-sm text-cream">Бейдж только с официального XP из реплея. Не +50 за катку.</p>
				</a>
				<a href="/party-search" className="obsidian-glass rounded-card p-5 hover:border-aegis/40">
					<div className="text-xs uppercase tracking-wide text-muted">Поиск пати</div>
					<p className="mt-2 text-sm text-cream">Собрать пятёрку через Steam. «Онлайн» — заход на арену за 15 минут, не клиент Dota.</p>
				</a>
			</div>
			<div className="mt-8">
				<SteamButton />
			</div>
		</section>
	);
}
