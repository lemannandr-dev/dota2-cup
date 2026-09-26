import { SteamButton } from '@/components/dota/SteamButton';
import { TournamentCreateForm } from '@/components/tournaments/TournamentCreateForm';

export function CreateTournamentScreen({ signedIn, walletBalance = 0 }: { signedIn: boolean; walletBalance?: number }) {
	return (
		<main className="max-w-3xl mx-auto px-4 py-12 space-y-6">
			{signedIn ? (
				<TournamentCreateForm walletBalance={walletBalance} />
			) : (
				<div className="obsidian-glass rounded-card p-6 md:p-8 space-y-4">
					<h1 className="font-display text-2xl text-cream">Новый турнир</h1>
					<p className="text-sm text-muted">
						Создание кубка доступно после входа через Steam. Затем капитаны заявляют пятёрки, вы принимаете заявки, после check-in собирается сетка и команды играют друг против друга.
					</p>
					<SteamButton />
				</div>
			)}
		</main>
	);
}
