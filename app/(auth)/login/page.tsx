import { SteamButton } from '@/components/dota/SteamButton';
import { safeAuthReturn } from '@/lib/auth-return';

const ERRORS: Record<string, string> = {
	expired: 'Время входа истекло. Начните вход заново в этом окне.',
	cancelled: 'Вход отменён. Приглашение сохранено, можно попробовать ещё раз.',
	verification: 'Steam не подтвердил вход. Попробуйте ещё раз.',
	unavailable: 'Не удалось завершить вход. Проверьте соединение и повторите попытку.'
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
	const params = await searchParams;
	const next = safeAuthReturn(params.next);
	return (
		<main className="mx-auto max-w-md px-6 py-16">
			<p className="text-xs uppercase tracking-[0.18em] text-muted">Aegis Arena</p>
			<h1 className="mt-3 font-display text-3xl text-cream">Вход</h1>
			{params.error && <p role="alert" className="mt-4 border-l-2 border-red-400 pl-3 text-sm text-red-200">{ERRORS[params.error] || ERRORS.unavailable}</p>}
			<p className="mt-3 text-sm leading-6 text-muted">
				Игроки, капитаны и судьи заходят только через Steam OpenID. Пароль Steam и Steam Guard сайт не спрашивает.
				Email и Discord турнирные права не дают.
			</p>
			<div className="mt-8">
				<SteamButton label={params.error ? 'Повторить вход через Steam' : 'Войти через Steam'} next={next} />
			</div>
			<a href={next} className="mt-4 inline-flex min-h-11 items-center text-sm text-muted">Вернуться</a>
		</main>
	);
}
