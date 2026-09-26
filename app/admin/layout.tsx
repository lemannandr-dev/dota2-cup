import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/rbac';
import { AdminNav } from '@/components/admin/AdminNav';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
	const admin = await requireAdmin();
	if (!admin.ok) redirect('/home');
	return (
		<div className="mx-auto max-w-admin space-y-4 px-3 pb-6 pt-4 md:space-y-6 md:px-6 md:py-6 lg:px-8">
			<header className="space-y-3">
				<p className="text-[10px] uppercase tracking-[0.16em] text-aegisSoft md:text-xs md:text-muted">Режим организатора</p>
				<h1 className="font-display text-2xl text-cream md:text-3xl">Панель управления</h1>
				<p className="hidden max-w-4xl text-sm text-muted md:block">
					Сначала очередь дел: споры, счёт на судье, фонд без эскроу. Подтверждённый приз только живым
					резервом. Чужому аккаунту сюда нельзя.
				</p>
				<AdminNav />
			</header>
			{children}
		</div>
	);
}
