import { describe, expect, it } from 'vitest';
import {
	broadcastFromInput,
	hasOfficialDesk,
	officialTwitchLogins,
	parseBroadcast,
	parseYoutubeWatchId,
	youtubeEmbedSrc
} from '@/lib/broadcast';

describe('broadcast package', () => {
	it('accepts a TI-style desk: main Twitch, RU desk, YouTube and Dota TV', () => {
		const config = broadcastFromInput({
			twitchChannel: 'https://twitch.tv/dota2ti',
			twitchSecondary: 'dota2ti_ru',
			youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9wgCcc',
			dotaTv: '8 123 456 7890',
			lobbyName: 'Aegis Cup Game 1',
			delaySec: 120,
			overlayTitle: 'Grand Final'
		});
		expect(config.twitch).toBe('dota2ti');
		expect(config.twitchSecondary).toBe('dota2ti_ru');
		expect(config.dotaTv).toBe('81234567890');
		expect(config.delaySec).toBe(120);
		expect(hasOfficialDesk(config)).toBe(true);
		expect(officialTwitchLogins(config)).toEqual(['dota2ti', 'dota2ti_ru']);
		expect(config.highlights).toEqual([]);
	});

	it('keeps highlight urls when the desk is updated', () => {
		const first = broadcastFromInput({
			twitchChannel: 'dota2ti',
			highlights: 'https://youtu.be/dQw4w9wgCcc\nhttps://twitch.tv/videos/123456789'
		});
		expect(first.highlights).toEqual(['https://youtu.be/dQw4w9wgCcc', 'https://twitch.tv/videos/123456789']);
		const next = broadcastFromInput({ twitchChannel: 'dota2ti_ru', previous: first });
		expect(next.twitch).toBe('dota2ti_ru');
		expect(next.highlights).toEqual(first.highlights);
	});

	it('rejects a random site as YouTube and keeps legacy stream line', () => {
		expect(parseYoutubeWatchId('https://example.com/watch?v=aaaaaaaaaaa')).toBeNull();
		expect(youtubeEmbedSrc('https://youtu.be/dQw4w9wgCcc')).toContain('dQw4w9wgCcc');
		expect(parseBroadcast(null, 'x').twitch).toBeNull();
		expect(officialTwitchLogins(null, 'stream:WePlayEsports')).toEqual(['weplayesports']);
	});
});
