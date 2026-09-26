import { z } from 'zod';

export const usernameSchema = z
	.string()
	.min(3, 'От 3 символов')
	.max(20, 'До 20 символов')
	.regex(/^[a-zA-Z0-9_]+$/, 'Только латиница, цифры и _');

export const registerSchema = z.object({
	displayName: z.string().min(2),
	username: usernameSchema,
	email: z.string().email(),
	password: z.string().min(6)
});













