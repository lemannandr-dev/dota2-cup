import { NextResponse } from 'next/server';
import { readTeamCover, type TeamCoverStorage } from '@/server/storage/team-cover';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ storage: string; path: string[] }> }) {
	const { storage, path } = await params;
	if (storage !== 'local' && storage !== 's3') {
		return NextResponse.json({ error: 'Файл не найден' }, { status: 404 });
	}
	try {
		const file = await readTeamCover(storage as TeamCoverStorage, path);
		return new NextResponse(Uint8Array.from(file.bytes), {
			headers: {
				'Content-Type': file.contentType,
				'Content-Disposition': 'inline',
				'Cache-Control': 'public, max-age=31536000, immutable',
				'X-Content-Type-Options': 'nosniff',
				'Content-Security-Policy': "default-src 'none'; script-src 'none'; object-src 'none'"
			}
		});
	} catch {
		return NextResponse.json({ error: 'Файл не найден' }, { status: 404 });
	}
}
