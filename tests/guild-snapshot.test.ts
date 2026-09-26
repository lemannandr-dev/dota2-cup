import { describe, expect, it } from 'vitest';
import { canShowGuildBlock, formatGuildGcStat, guildSnapshotIsFromGc, guildSnapshotSchema } from '@/lib/guild-snapshot';

describe('guild snapshot', () => {
	it('rejects a snapshot invented without a GC payload', () => {
		expect(
			guildSnapshotSchema.safeParse({
				guildId: '1',
				name: 'Fake',
				members: [],
				points: 999
			}).success
		).toBe(false);
		expect(
			guildSnapshotSchema.safeParse({
				source: 'guess',
				guildId: '1',
				name: 'Fake',
				members: [],
				payload: {}
			}).success
		).toBe(false);
	});

	it('accepts only a GC-marked payload', () => {
		const parsed = guildSnapshotSchema.safeParse({
			source: 'gc',
			guildId: '42',
			name: 'Aegis',
			members: [],
			payload: { gcMessage: 'CMsgDOTAGuildData', points: 12 }
		});
		expect(parsed.success).toBe(true);
	});

	it('hides the profile block without a real GC snapshot', () => {
		expect(guildSnapshotIsFromGc({})).toBe(false);
		expect(canShowGuildBlock({ lastSyncedAt: new Date(), snapshotPayload: { note: 'guessed' } })).toBe(false);
		expect(
			canShowGuildBlock({
				lastSyncedAt: new Date(),
				snapshotPayload: { gcMessage: 'CMsgDOTAGuildData' }
			})
		).toBe(true);
		expect(formatGuildGcStat(null)).toBe('Нет данных');
		expect(formatGuildGcStat(12)).toBe('12');
	});
});
