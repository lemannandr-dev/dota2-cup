import { describe, expect, it } from 'vitest';
import { collectTwitchLogins, parseTwitchLogin, withStreamRule } from '@/lib/twitch';

describe('twitch logins', () => {
	it('parses urls and stream rules', () => {
		expect(parseTwitchLogin('https://www.twitch.tv/dota2ti')).toBe('dota2ti');
		expect(collectTwitchLogins('stream:WePlayEsports\nправила', 'https://twitch.tv/dota2ti')).toEqual([
			'weplayesports',
			'dota2ti'
		]);
		expect(withStreamRule('BO1 only', 'Twitch.tv/AegisCup')).toBe('stream:aegiscup\nBO1 only');
	});
});
