import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import {
	MAX_APPEARANCE_IMAGE_BYTES,
	appearanceAssetFields,
	appearanceStorageKinds,
	type AppearanceAssetField,
	type AppearanceStorageKind
} from '@/lib/site-appearance';
import { assertRateLimit } from '@/server/rate-limit';
import { DomainError, toErrorResponse } from '@/server/errors';
import { storeAppearanceImage } from '@/server/storage/appearance';
import { s3Configured } from '@/server/storage/s3';
import { normalizeAppearanceImage } from '@/server/storage/appearance-image';
import { isSameOriginAppearanceRequest, readAppearanceBody } from '@/server/appearance-request';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
	const admin = await requireAdmin();
	if (!admin.ok || !isSameOriginAppearanceRequest(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

	try {
		await assertRateLimit(`appearance-upload:${admin.user.id}`, 20, 600);
	} catch (error) {
		const mapped = toErrorResponse(error);
		return NextResponse.json({ error: mapped.error }, { status: mapped.status });
	}

	let form: FormData;
	try {
		const body = await readAppearanceBody(request, MAX_APPEARANCE_IMAGE_BYTES + 64 * 1024);
		form = await new Response(Uint8Array.from(body), { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
	} catch (error) {
		return NextResponse.json({ error: error instanceof DomainError ? error.message : 'Некорректный файл' }, { status: error instanceof DomainError ? error.status : 400 });
	}
	const file = form.get('file');
	const field = form.get('field');
	const storage = form.get('storage');
	if (!(file instanceof File)) return NextResponse.json({ error: 'Файл не передан' }, { status: 400 });
	if (typeof field !== 'string' || !appearanceAssetFields.includes(field as AppearanceAssetField)) {
		return NextResponse.json({ error: 'Неизвестный тип изображения' }, { status: 400 });
	}
	if (typeof storage !== 'string' || !appearanceStorageKinds.includes(storage as AppearanceStorageKind)) {
		return NextResponse.json({ error: 'Неизвестное хранилище' }, { status: 400 });
	}
	if (storage === 's3' && !s3Configured()) {
		return NextResponse.json({ error: 'S3 не настроен на сервере' }, { status: 503 });
	}
	if (file.size <= 0 || file.size > MAX_APPEARANCE_IMAGE_BYTES) {
		return NextResponse.json({ error: 'Размер изображения должен быть не больше 10 МБ' }, { status: 400 });
	}

	const bytes = Buffer.from(await file.arrayBuffer());
	try {
	const image = await normalizeAppearanceImage(bytes, field as AppearanceAssetField);
	const stored = await storeAppearanceImage({
		field: field as AppearanceAssetField,
		storage: storage as AppearanceStorageKind,
		bytes: image.bytes,
		contentType: image.contentType,
		extension: image.extension
	});
	await prisma.auditLog.create({
		data: {
			actorId: admin.user.id,
			action: 'SITE_APPEARANCE_IMAGE_UPLOADED',
			entity: 'SiteAppearance',
			entityId: field,
			payload: { storage, key: stored.key, contentType: image.contentType, bytes: image.bytes.length }
		}
	});
	return NextResponse.json({ url: stored.url });
	} catch (error) {
		return NextResponse.json({ error: error instanceof DomainError ? error.message : 'Хранилище недоступно. Файл не применён.' }, { status: error instanceof DomainError ? error.status : 503 });
	}
}
