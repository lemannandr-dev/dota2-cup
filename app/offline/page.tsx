import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
	return (
		<main className="mx-auto flex min-h-[70dvh] max-w-lg items-center px-4 py-12">
		<section className="obsidian-glass w-full rounded-card p-6 text-center">
			<WifiOff className="mx-auto h-8 w-8 text-aegisSoft" aria-hidden="true" />
			<h1 className="mt-4 font-display text-2xl text-cream">Нет соединения</h1>
			<p className="mt-2 text-sm leading-6 text-muted">
				Для заявок, лобби и результатов нужна сеть. Проверьте соединение и повторите попытку.
			</p>
			<a href="/home" className="aegis-action mt-5 inline-flex min-h-12 items-center justify-center rounded-lg bg-aegis px-5 text-sm font-semibold text-ink">
				Повторить
			</a>
		</section>
		</main>
	);
}
