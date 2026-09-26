import Link from 'next/link';
import BonusCodeForm from '@/components/balance/BonusCodeForm';
import { WalletLedger } from '@/components/balance/WalletLedger';
import { AtmosphereWash } from '@/components/desk/AtmosphereWash';
import { PlayerAccountRail } from '@/components/layout/PlayerAccountRail';
import { formatPrizeAmount } from '@/lib/prize-places';
import { catalogStatusLabel } from '@/lib/tournament-catalog';
import { formatMoscowDateTime } from '@/lib/datetime';
import type { WalletTx } from '@/lib/wallet';

export type BalanceEscrowCup = {
	id: string;
	title: string;
	prizePool: number;
	status: string;
};

export type BalancePromo = {
	id: string;
	code: string;
	amount: number;
	note: string;
	createdAt: string;
};

export function BalanceDesk({
	balance,
	earned,
	spent,
	escrowHeld,
	cups,
	pendingCups,
	promos,
	ledger,
	canHost,
	profileHref
}: {
	balance: number;
	earned: number;
	spent: number;
	escrowHeld: number;
	cups: BalanceEscrowCup[];
	pendingCups: BalanceEscrowCup[];
	promos: BalancePromo[];
	ledger: WalletTx[];
	canHost: boolean;
	profileHref: string;
}) {
	return (
		<main className="mx-auto max-w-shell space-y-8 px-4 py-12 md:px-6 lg:px-10">
			<PlayerAccountRail profileHref={profileHref} />
			<header className="obsidian-glass relative overflow-hidden rounded-card p-5 md:p-6">
				<AtmosphereWash tone="bronze" />
				<div className="relative">
					<p className="font-mono text-xs uppercase tracking-[0.22em] text-aegisSoft">Кошелёк</p>
					<h1 className="mt-3 font-display text-4xl text-cream">Баланс</h1>
					<p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
						Здесь свои деньги арены. Сайт 15 000 ₽ сам не печатает. Фонд кубка списывается в эскроу с этого кошелька.
						Выплата 70/30 — капитанам 1 и 2 места, не всей пятёрке.
					</p>
					<div className="mt-4 flex flex-wrap gap-2 text-xs">
						<a href="#promo" className="rounded-full border border-line px-3 py-1.5 text-muted hover:text-cream">
							Промокод
						</a>
						<a href="#history" className="rounded-full border border-line px-3 py-1.5 text-muted hover:text-cream">
							История
						</a>
						<Link href="/tournaments" className="rounded-full border border-line px-3 py-1.5 text-muted hover:text-cream">
							Каталог кубков
						</Link>
						{canHost && (
							<Link href="/tournaments/new" className="rounded-full border border-aegis/40 px-3 py-1.5 text-aegisSoft hover:text-aegis">
								Собрать кубок
							</Link>
						)}
					</div>
				</div>
			</header>

			<section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<article className="obsidian-glass relative overflow-hidden rounded-card p-5">
					<AtmosphereWash tone="bronze" soft />
					<div className="relative">
						<p className="text-[10px] uppercase tracking-[0.16em] text-muted">Доступно</p>
						<p className="mt-2 font-display text-3xl text-cream">{formatPrizeAmount(balance)}</p>
						<p className="mt-2 text-xs leading-5 text-muted">
							Можно ставить под фонд. Эскроу живых кубков уже списан и сюда не входит.
						</p>
					</div>
				</article>
				<article className="obsidian-glass rounded-card p-5">
					<p className="text-[10px] uppercase tracking-[0.16em] text-muted">Пришло</p>
					<p className="mt-2 font-mono text-xl text-radiant">{formatPrizeAmount(earned)}</p>
					<p className="mt-2 text-xs leading-5 text-muted">Пополнение орга, приз капитану, промо.</p>
				</article>
				<article className="obsidian-glass rounded-card p-5">
					<p className="text-[10px] uppercase tracking-[0.16em] text-muted">Ушло</p>
					<p className="mt-2 font-mono text-xl text-cream">{formatPrizeAmount(spent)}</p>
					<p className="mt-2 text-xs leading-5 text-muted">Эскроу фондов и списания. Возврат эскроу уменьшает эту цифру.</p>
				</article>
			</section>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<section id="promo" className="obsidian-glass rounded-card p-5">
					<h2 className="font-display text-xl text-cream">Промокод</h2>
					<p className="mt-1 text-sm text-muted">Код выдаёт орг. Один раз на аккаунт. Активация пишет строку в историю.</p>
					<div className="mt-4">
						<BonusCodeForm />
					</div>
					{promos.length > 0 && (
						<div className="mt-5 border-t border-line/50 pt-4">
							<p className="text-[10px] uppercase tracking-[0.16em] text-muted">Уже активированы</p>
							<ul className="mt-2 space-y-2">
								{promos.map((promo) => (
									<li key={promo.id} className="flex items-baseline justify-between gap-2 text-sm">
										<div className="min-w-0">
											<p className="font-mono text-cream">{promo.code}</p>
											<p className="text-[11px] text-muted">
												{promo.note} · {formatMoscowDateTime(promo.createdAt)}
											</p>
										</div>
										<span className="shrink-0 font-mono text-radiant">+{formatPrizeAmount(promo.amount)}</span>
									</li>
								))}
							</ul>
						</div>
					)}
				</section>
				<section className="obsidian-glass rounded-card p-5">
					<h2 className="font-display text-xl text-cream">Эскроу и фонды</h2>
					<p className="mt-1 text-sm text-muted">
						На живых кубках сейчас держится {formatPrizeAmount(escrowHeld)}. Это уже не доступный остаток.
					</p>
					{pendingCups.length > 0 && (
						<div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
							<p className="text-xs text-amber-100">Фонд не зарезервирован — на кошельке не хватило при публикации.</p>
							<ul className="mt-2 space-y-2">
								{pendingCups.map((cup) => (
									<li key={cup.id}>
										<Link href={`/tournaments/${cup.id}`} className="flex items-baseline justify-between gap-2 text-sm hover:text-aegisSoft">
											<span className="min-w-0 truncate text-cream">{cup.title}</span>
											<span className="shrink-0 font-mono text-amber-100">{formatPrizeAmount(cup.prizePool)}</span>
										</Link>
									</li>
								))}
							</ul>
						</div>
					)}
					{cups.length === 0 ? (
						<p className="mt-4 text-sm text-muted">
							Нет живого кубка с подтверждённым фондом.{' '}
							<Link href="/tournaments" className="text-aegisSoft hover:text-aegis">
								Каталог
							</Link>
						</p>
					) : (
						<ul className="mt-4 space-y-2">
							{cups.map((cup) => (
								<li key={cup.id}>
									<Link href={`/tournaments/${cup.id}`} className="flex items-baseline justify-between gap-2 text-sm hover:text-aegisSoft">
										<span className="min-w-0 truncate text-cream">
											{cup.title} · {catalogStatusLabel(cup.status)}
										</span>
										<span className="shrink-0 font-mono text-aegisSoft">{formatPrizeAmount(cup.prizePool)}</span>
									</Link>
								</li>
							))}
						</ul>
					)}
				</section>
			</div>

			<WalletLedger items={ledger} />
		</main>
	);
}
