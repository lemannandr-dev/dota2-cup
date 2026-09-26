import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const user = await prisma.user.findUnique({
		where: { id },
		select: {
			id: true,
			userId: true,
			displayName: true,
			username: true,
			avatarUrl: true,
			rating: true,
			ratingGames: true,
			level: true,
			steamId: true,
			role: true
		}
	});
	if (!user) return NextResponse.json({ error: 'not found' }, { status: 404 });
	return NextResponse.json({
		user: {
			id: user.id,
			userId: user.userId,
			displayName: user.displayName,
			username: user.username,
			avatarUrl: user.avatarUrl,
			rating: user.ratingGames > 0 ? user.rating : null,
			ratingGames: user.ratingGames,
			level: user.level,
			role: user.role,
			steamVerified: Boolean(user.steamId)
		}
	});
}
