import { describe, expect, it } from 'vitest';
import {
	canPostMatchLobby,
	canViewMatchLobby,
	isAllowedVoiceUrl,
	parseMatchLobby,
	publicMatchLobby,
	writeMatchLobby
} from '@/lib/match-lobby';

describe('match lobby', () => {
	it('keeps the password only for people in the pair', () => {
		const lobby = writeMatchLobby({
			name: 'Aegis R1',
			password: 'radiant',
			region: 'EU West',
			hostName: 'Искры',
			voiceUrl: 'https://discord.gg/aegis'
		});
		expect(lobby.password).toBe('radiant');
		expect(publicMatchLobby(lobby, false)?.password).toBeNull();
		expect(publicMatchLobby(lobby, true)?.password).toBe('radiant');
	});

	it('rejects a random voice link and a stranger posting the lobby', () => {
		expect(isAllowedVoiceUrl('https://example.com/voice')).toBe(false);
		expect(parseMatchLobby({ name: 'x' })).toBeNull();
		expect(canPostMatchLobby('stranger', 'cap-a', 'cap-b', false)).toBe(false);
		expect(canPostMatchLobby('cap-a', 'cap-a', 'cap-b', false)).toBe(true);
		expect(canViewMatchLobby('player', ['cap-a', 'player'], false)).toBe(true);
		expect(canViewMatchLobby('stranger', ['cap-a', 'player'], false)).toBe(false);
	});
});
