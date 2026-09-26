import { prisma } from './prisma';

const STARTING_ID = 10000000000;

export async function generateUserId(): Promise<string> {
	const last = await prisma.user.findFirst({ orderBy: { userId: 'desc' }, select: { userId: true } });
	if (!last?.userId) return `id${STARTING_ID}`;
	const lastNum = parseInt(last.userId.replace('id', ''), 10);
	const next = Number.isFinite(lastNum) ? lastNum + 1 : STARTING_ID;
	return `id${next}`;
}

export async function validateUsername(username: string): Promise<{ isValid: boolean; error?: string }>{
	if (!username) return { isValid: false, error: 'Имя не указано' };
	if (username.length < 3 || username.length > 20) return { isValid: false, error: 'От 3 до 20 символов' };
	if (!/^[a-zA-Z0-9_]+$/.test(username)) return { isValid: false, error: 'Только латиница, цифры и _' };
	const forbidden = ['admin', 'moderator', 'support', 'api', 'www', 'mail', 'ftp'];
	if (forbidden.includes(username.toLowerCase())) return { isValid: false, error: 'Имя зарезервировано' };
	const exists = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
	if (exists) return { isValid: false, error: 'Имя уже занято' };
	return { isValid: true };
}













