import { z } from 'zod';

export const bonusCodeSchema = z.object({
	code: z.string().trim().min(4).max(32).regex(/^[A-Za-z0-9_-]+$/),
	amount: z.number().int().min(1).max(5_000_000),
	description: z.string().trim().min(1).max(200),
	maxUses: z.number().int().positive().nullable().optional(),
	validUntil: z.string().nullable().optional(),
	minLevel: z.number().int().min(0).nullable().optional(),
	roles: z.array(z.enum(['USER', 'GAMER', 'ORGANIZER', 'ADMIN'])).optional()
});













