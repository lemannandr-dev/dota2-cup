import { OverlayBar } from '@/components/tournaments/OverlayBar';

export const dynamic = 'force-dynamic';

export default async function OverlayPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	return (
		<main className="min-h-screen bg-transparent p-6">
			<OverlayBar tournamentId={id} />
		</main>
	);
}
