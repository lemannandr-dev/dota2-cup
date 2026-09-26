import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentSteamUser } from '@/server/auth/session';
import { isAllowedEvidenceImage, isAllowedVodUrl } from '@/lib/access-policy';
import { loadMatchEvidenceGate } from '@/server/disputes/gate';
import { getPrivateObject, putPrivateObject, s3Configured } from '@/server/storage/s3';
import { assertRateLimit } from '@/server/rate-limit';
import { toErrorResponse } from '@/server/errors';
import { randomBytes } from 'node:crypto';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 4 * 1024 * 1024;

function safeFileName(name: string) {
	return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'evidence';
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; disputeId: string }> }) {
	const { id: matchId, disputeId } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	const gate = await loadMatchEvidenceGate(matchId, user);
	if (!gate) return NextResponse.json({ error: 'Матч не найден' }, { status: 404 });
	if (!gate.canView) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

	const dispute = gate.match.disputes.find((row) => row.id === disputeId);
	if (!dispute || !dispute.evidenceKey) {
		return NextResponse.json({ error: 'Вложение не найдено' }, { status: 404 });
	}
	try {
		const object = await getPrivateObject(dispute.evidenceKey);
		return new NextResponse(Uint8Array.from(object.bytes), {
			headers: {
				'Content-Type': object.contentType,
				'Cache-Control': 'private, max-age=60'
			}
		});
	} catch {
		return NextResponse.json({ error: 'Файл недоступен' }, { status: 404 });
	}
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; disputeId: string }> }) {
	const { id: matchId, disputeId } = await params;
	const user = await getCurrentSteamUser();
	if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	const gate = await loadMatchEvidenceGate(matchId, user);
	if (!gate) return NextResponse.json({ error: 'Матч не найден' }, { status: 404 });
	if (!gate.canUpload) return NextResponse.json({ error: 'Вложение может добавить участник пары или судья' }, { status: 403 });

	const dispute = gate.match.disputes.find((row) => row.id === disputeId);
	if (!dispute) return NextResponse.json({ error: 'Спор не найден' }, { status: 404 });

	try {
		await assertRateLimit(`dispute-evidence:${user.id}`, 8, 600);
	} catch (error) {
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}

	const contentType = req.headers.get('content-type') || '';
	if (contentType.includes('application/json')) {
		const body = (await req.json()) as { vodUrl?: string };
		if (!body.vodUrl || !isAllowedVodUrl(body.vodUrl)) {
			return NextResponse.json({ error: 'Нужна https-ссылка YouTube или Twitch' }, { status: 400 });
		}
		const updated = await prisma.dispute.update({
			where: { id: dispute.id },
			data: { evidenceUrl: body.vodUrl, evidenceKind: 'vod', evidenceName: 'VOD', evidenceKey: null }
		});
		await prisma.auditLog.create({
			data: {
				actorId: user.id,
				action: 'DISPUTE_EVIDENCE_ADDED',
				entity: 'Dispute',
				entityId: updated.id,
				payload: { kind: 'vod' }
			}
		});
		return NextResponse.json({ ok: true, kind: 'vod' });
	}

	if (!s3Configured()) {
		return NextResponse.json({ error: 'Загрузка скрина недоступна: S3 не настроен' }, { status: 503 });
	}

	const form = await req.formData();
	const file = form.get('file');
	if (!(file instanceof File)) return NextResponse.json({ error: 'Файл не передан' }, { status: 400 });
	if (!isAllowedEvidenceImage(file.type)) {
		return NextResponse.json({ error: 'Только PNG, JPEG или WebP' }, { status: 400 });
	}
	if (file.size <= 0 || file.size > MAX_BYTES) {
		return NextResponse.json({ error: 'Файл больше 4 МБ' }, { status: 400 });
	}

	const bytes = Buffer.from(await file.arrayBuffer());
	const key = `disputes/${dispute.id}/${randomBytes(8).toString('hex')}-${safeFileName(file.name)}`;
	await putPrivateObject(key, bytes, file.type);
	const updated = await prisma.dispute.update({
		where: { id: dispute.id },
		data: { evidenceKey: key, evidenceKind: 'image', evidenceName: file.name.slice(0, 120), evidenceUrl: null }
	});
	await prisma.auditLog.create({
		data: {
			actorId: user.id,
			action: 'DISPUTE_EVIDENCE_ADDED',
			entity: 'Dispute',
			entityId: updated.id,
			payload: { kind: 'image' }
		}
	});
	return NextResponse.json({ ok: true, kind: 'image' });
}
