import { describe, expect, it } from 'vitest';
import { storedMedalOf, storedRankOf } from '@/lib/dota-rank';
import { heroImage, heroSlug, heroSlugFromSrc } from '@/lib/hero-image';
import { abilityIconsFromIds } from '@/lib/match-recap';
import { haptic, hapticTap } from '@/lib/haptics';

describe('storedRankOf', () => {
	it('maps prisma fields without inventing tier', () => {
		expect(storedRankOf(null)).toBeNull();
		expect(storedRankOf({ openDotaRankTier: null })).toBeNull();
		expect(storedRankOf({ openDotaRankTier: 55, openDotaLeaderboard: 12 })).toEqual({
			rankTier: 55,
			leaderboardRank: 12
		});
		expect(storedMedalOf({ openDotaRankTier: 55, openDotaLeaderboard: 12 })?.tier).toBeTruthy();
	});
});

describe('hero-image', () => {
	it('builds local vert path from api name', () => {
		expect(heroSlug('npc_dota_hero_axe')).toBe('axe');
		expect(heroImage('npc_dota_hero_axe', 'vert')).toBe('/heroes/axe_vert.webp');
		expect(heroSlugFromSrc('/heroes/axe_vert.webp')).toBe('axe');
		expect(heroSlugFromSrc('https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/axe.png')).toBe('axe');
	});
});

describe('abilityIconsFromIds', () => {
	it('returns undefined when empty and icons when present', () => {
		expect(abilityIconsFromIds([])).toBeUndefined();
		expect(abilityIconsFromIds(null)).toBeUndefined();
		const icons = abilityIconsFromIds(['axe_berserkers_call']);
		expect(icons?.[0].src).toContain('abilities/axe_berserkers_call.png');
	});
});

describe('haptics', () => {
	it('does not throw without vibrate', () => {
		expect(() => hapticTap()).not.toThrow();
		expect(() => haptic('tap')).not.toThrow();
		expect(() => haptic('success')).not.toThrow();
	});
});
