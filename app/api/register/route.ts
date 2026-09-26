import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateUserId, validateUsername } from '@/lib/user-id-generator';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
	// /api/register/check-username?u=...
	const { searchParams } = new URL(req.url);
	const u = searchParams.get('u') || '';
	const result = await validateUsername(u);
	return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
	try {
		const { email, password, username, displayName } = await req.json();
		if (!email || !password || !displayName || !username) {
			return NextResponse.json({ error: 'Заполните все поля' }, { status: 400 });
		}
		const check = await validateUsername(username);
		if (!check.isValid) return NextResponse.json({ error: check.error }, { status: 400 });

		const userId = await generateUserId();
		const hashed = await bcrypt.hash(password, 12);
		const user = await prisma.user.create({
			data: {
				userId,
				username: username.toLowerCase(),
				email,
				password: hashed,
				displayName
			}
		});
		return NextResponse.json({ success: true, user: { id: user.id, userId: user.userId, username: user.username } });
	} catch {
		return NextResponse.json({ error: 'Ошибка регистрации' }, { status: 500 });
	}
}













