import { NextResponse } from 'next/server';
import { getCurrentSteamUser } from '@/server/auth/session';
import { canConsumePlusCdn } from '@/lib/plus-cdn-limit';
import { readPlusCdnUsed } from '@/lib/plus-cdn-usage';
import { beginPlusSyncJob, readPlusSyncJob } from '@/lib/plus-sync-job';

export const dynamic = 'force-dynamic';

export async function GET() {
	const user = await getCurrentSteamUser();
	if (!user?.steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	const job = await readPlusSyncJob(user.id);
	return NextResponse.json({ job });
}

export async function POST() {
	const user = await getCurrentSteamUser();
	if (!user?.steamId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const cdn = canConsumePlusCdn(await readPlusCdnUsed(user.id));
	if (!cdn.ok) {
		return NextResponse.json(
			{
				error: `Лимит скачиваний Valve на этот час: ${cdn.used} из ${cdn.max}. Подождите, не долбим replay CDN.`,
				code: cdn.code
			},
			{ status: 429 }
		);
	}

	const started = await beginPlusSyncJob(user.id, user.steamId);
	if (!started.ok) {
		const status = started.code === 'cooldown' ? 429 : started.code === 'queue_unavailable' ? 503 : 409;
		const error =
			started.code === 'cooldown'
				? 'Подождите 10 минут перед следующей загрузкой реплеев'
				: started.code === 'queue_unavailable'
					? started.job.error || 'Очередь Plus недоступна'
					: 'Синхронизация уже идёт';
		return NextResponse.json({ error, job: started.job }, { status });
	}

	return NextResponse.json({ ok: true, accepted: true, job: started.job }, { status: 202 });
}
