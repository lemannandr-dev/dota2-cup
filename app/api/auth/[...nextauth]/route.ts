import { NextResponse } from 'next/server';

const body = { error: 'Вход только через Steam OpenID. Email и Discord не открывают турнир.' };

export function GET() {
	return NextResponse.json(body, { status: 410 });
}

export function POST() {
	return NextResponse.json(body, { status: 410 });
}
