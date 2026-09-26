import { describe, expect, it } from 'vitest';
import { collectExternalDest, isDiscordWebhook, parseTelegramChatId } from '@/lib/external-notify';

describe('external notify dest', () => {
	it('accepts only Discord incoming webhooks', () => {
		expect(isDiscordWebhook('https://discord.com/api/webhooks/1/abc')).toBe(true);
		expect(isDiscordWebhook('https://discord.gg/invite')).toBe(false);
		expect(isDiscordWebhook('https://example.com/api/webhooks/1/abc')).toBe(false);
	});

	it('parses numeric Telegram chat ids', () => {
		expect(parseTelegramChatId('-1001234567890')).toBe('-1001234567890');
		expect(parseTelegramChatId('12345')).toBe('12345');
		expect(parseTelegramChatId('@channel')).toBeNull();
		expect(parseTelegramChatId('t.me/room')).toBeNull();
	});

	it('collects unique webhook and chat dests', () => {
		const dest = collectExternalDest({
			contactUrl: 'https://discord.com/api/webhooks/1/abc',
			notifyWebhook: 'https://discord.com/api/webhooks/1/abc',
			telegramChatId: '-1001234567890',
			broadcastWebhook: 'https://discord.com/api/webhooks/2/xyz',
			broadcastTelegram: '-1001234567890'
		});
		expect(dest.webhooks).toEqual([
			'https://discord.com/api/webhooks/1/abc',
			'https://discord.com/api/webhooks/2/xyz'
		]);
		expect(dest.telegramChats).toEqual(['-1001234567890']);
	});
});
