import { describe, expect, it } from 'vitest';
import { detectTeamCover, teamCoverLimit } from '@/lib/team-cover';

function bytes(value: string) {
	return Uint8Array.from(value, (char) => char.charCodeAt(0));
}

describe('team cover detection', () => {
	it('accepts png, gif and mp4 by magic bytes', () => {
		const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
		expect(detectTeamCover(png)?.contentType).toBe('image/png');
		expect(detectTeamCover(bytes('GIF89a........'))?.kind).toBe('image');
		const mp4 = bytes('xxxxftypisom');
		expect(detectTeamCover(mp4)).toMatchObject({ kind: 'video', contentType: 'video/mp4' });
	});

	it('rejects html, svg and short files', () => {
		expect(detectTeamCover(bytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
		expect(detectTeamCover(bytes('<!doctype html><script>alert(1)</script>'))).toBeNull();
		expect(detectTeamCover(bytes('GIF'))).toBeNull();
		expect(teamCoverLimit('video')).toBeGreaterThan(teamCoverLimit('image'));
	});
});
