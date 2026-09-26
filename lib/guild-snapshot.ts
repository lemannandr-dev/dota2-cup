import { z } from 'zod';

const memberSchema = z.object({
	steamId: z.string().regex(/^\d{17}$/),
	displayName: z.string().trim().min(1).max(128).optional(),
	role: z.string().trim().min(1).max(64).optional(),
	points: z.number().int().min(0).max(2_000_000_000).optional(),
	joinedAt: z.string().datetime().optional()
});

export const guildSnapshotSchema = z.object({
	source: z.literal('gc'),
	guildId: z.string().trim().min(1).max(64),
	name: z.string().trim().min(1).max(128),
	tag: z.string().trim().min(1).max(32).optional(),
	avatarUrl: z.string().url().max(2048).optional(),
	points: z.number().int().min(0).max(2_000_000_000).optional(),
	leaderboardRank: z.number().int().positive().max(10_000_000).optional(),
	level: z.number().int().positive().max(10_000).optional(),
	members: z.array(memberSchema).max(500),
	capturedAt: z.string().datetime().optional(),
	payload: z
		.object({
			gcMessage: z.string().trim().min(3).max(128)
		})
		.passthrough()
});

export function guildSnapshotIsFromGc(payload: unknown) {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
	const gcMessage = (payload as { gcMessage?: unknown }).gcMessage;
	return typeof gcMessage === 'string' && gcMessage.trim().length >= 3;
}

export function canShowGuildBlock(input: {
	lastSyncedAt?: Date | string | null;
	snapshotPayload?: unknown;
}) {
	return Boolean(input.lastSyncedAt) && guildSnapshotIsFromGc(input.snapshotPayload);
}

export function formatGuildGcStat(value: number | string | null | undefined) {
	if (value === null || value === undefined || value === '') return 'Нет данных';
	return String(value);
}
