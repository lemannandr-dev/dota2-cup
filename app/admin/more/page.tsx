import { BookOpenCheck, Gift, KeyRound, Paintbrush, ShieldCheck, UsersRound } from 'lucide-react';

const sections = [
	{ href: '/admin/users', label: 'Игроки', hint: 'Аккаунты, роли и доступ', icon: UsersRound },
	{ href: '/admin/teams', label: 'Команды', hint: 'Составы и блокировки', icon: ShieldCheck },
	{ href: '/admin/bonus-codes', label: 'Бонусные коды', hint: 'Выпуск и использование', icon: KeyRound },
	{ href: '/admin/referrals', label: 'Рефералка', hint: 'Пороги и сумма на баланс', icon: Gift },
	{ href: '/admin/ledger', label: 'Журнал операций', hint: 'Проводки и полный аудит', icon: BookOpenCheck },
	{ href: '/admin/appearance', label: 'Оформление', hint: 'Логотипы, фон, движение и хранилище', icon: Paintbrush }
];

export default function AdminMorePage() {
	return (
		<section className="space-y-3">
			<h2 className="font-display text-xl text-cream">Остальные инструменты</h2>
			<div className="grid gap-3 sm:grid-cols-2">
				{sections.map((section) => {
					const Icon = section.icon;
					return (
						<a key={section.href} href={section.href} className="obsidian-glass flex min-h-20 items-center gap-3 rounded-card p-4 transition-colors hover:border-aegis/50">
							<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-panel2 text-aegisSoft">
								<Icon className="h-5 w-5" aria-hidden="true" />
							</span>
							<span>
								<span className="block text-sm font-semibold text-cream">{section.label}</span>
								<span className="mt-1 block text-xs text-muted">{section.hint}</span>
							</span>
						</a>
					);
				})}
			</div>
		</section>
	);
}
