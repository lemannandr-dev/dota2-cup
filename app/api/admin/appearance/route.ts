import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/rbac';
import { DEFAULT_SITE_APPEARANCE, siteAppearanceUpdateSchema } from '@/lib/site-appearance';
import { getSiteAppearance, resetSiteAppearance, saveSiteAppearance } from '@/server/site-appearance';
import { s3Configured } from '@/server/storage/s3';
import { isSameOriginAppearanceRequest, readAppearanceBody } from '@/server/appearance-request';

export const dynamic = 'force-dynamic';

export async function GET() {
	const admin = await requireAdmin();
	if (!admin.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	return NextResponse.json({
		appearance: await getSiteAppearance(),
		defaults: DEFAULT_SITE_APPEARANCE,
		storage: { local: true, s3: s3Configured() }
	});
}

export async function PATCH(request: Request) {
	const admin = await requireAdmin();
	if (!admin.ok || !isSameOriginAppearanceRequest(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

	let body: unknown;
	try {
		body = JSON.parse((await readAppearanceBody(request, 16 * 1024)).toString('utf8'));
	} catch {
		return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 });
	}
	const parsed = siteAppearanceUpdateSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Проверьте поля оформления' }, { status: 400 });
	}

	try {
		const appearance = await saveSiteAppearance(parsed.data, admin.user.id);
		revalidatePath('/', 'layout');
		return NextResponse.json({ appearance });
	} catch {
		return NextResponse.json({ error: 'Оформление не сохранено. Повторите попытку.' }, { status: 503 });
	}
}

export async function DELETE(request: Request) {
	const admin = await requireAdmin();
	if (!admin.ok || !isSameOriginAppearanceRequest(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	try {
		const appearance = await resetSiteAppearance(admin.user.id);
		revalidatePath('/', 'layout');
		return NextResponse.json({ appearance });
	} catch {
		return NextResponse.json({ error: 'Не удалось восстановить оформление. Повторите попытку.' }, { status: 503 });
	}
}
