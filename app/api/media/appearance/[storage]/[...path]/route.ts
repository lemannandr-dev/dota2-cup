import { NextResponse } from 'next/server';
import { readAppearanceImage } from '@/server/storage/appearance';
import type { AppearanceStorageKind } from '@/lib/site-appearance';

export const dynamic = 'force-dynamic';

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ storage: string; path: string[] }> }
) {
	const { storage, path } = await params;
	if (storage !== 'local' && storage !== 's3') {
		return NextResponse.json({ error: 'Изображение не найдено' }, { status: 404 });
	}
	try {
		const image = await readAppearanceImage(storage as AppearanceStorageKind, path);
		return new NextResponse(Uint8Array.from(image.bytes), {
			headers: {
				'Content-Type': image.contentType,
				'Cache-Control': 'public, max-age=31536000, immutable',
				'X-Content-Type-Options': 'nosniff'
			}
		});
	} catch {
		return NextResponse.json({ error: 'Изображение не найдено' }, { status: 404 });
	}
}
