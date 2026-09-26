import { z } from 'zod';

export const referralMilestoneSchema = z.object({
	threshold: z.number().int().min(1).max(100_000),
	amount: z.number().int().positive().max(50_000_000),
	label: z.string().trim().min(1).max(80)
});
