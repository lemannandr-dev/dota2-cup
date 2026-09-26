import { z } from 'zod';

export const SITE_APPEARANCE_ID = 'primary';

export const DEFAULT_SITE_APPEARANCE = {
	id: SITE_APPEARANCE_ID,
	appLogoUrl: '/icons/aegis-arena-48.png',
	dotaLogoUrl: '/dota2-logo-symbol-64.png',
	mobileBackdropUrl: '/brand/dota2-scene-900.webp',
	homeCoverUrl: '/brand/dota2-heroes.webp',
	motionEnabled: true,
	backdropOpacity: 24,
	backdropPositionY: 42
} as const;

export type SiteAppearance = {
	id: string;
	appLogoUrl: string;
	dotaLogoUrl: string;
	mobileBackdropUrl: string;
	homeCoverUrl: string;
	motionEnabled: boolean;
	backdropOpacity: number;
	backdropPositionY: number;
};

export const appearanceAssetFields = ['appLogoUrl', 'dotaLogoUrl', 'mobileBackdropUrl', 'homeCoverUrl'] as const;
export type AppearanceAssetField = (typeof appearanceAssetFields)[number];

export const appearanceStorageKinds = ['local', 's3'] as const;
export type AppearanceStorageKind = (typeof appearanceStorageKinds)[number];

export const MAX_APPEARANCE_IMAGE_BYTES = 10 * 1024 * 1024;

export function isAllowedAppearanceUrl(value: string) {
	const url = value.trim();
	if (/[\u0000-\u0020\u007f\\]/.test(url)) return false;
	if (url.startsWith('/') && !url.startsWith('//')) {
		try {
			const decoded = decodeURIComponent(url);
			return !decoded.startsWith('//') && !/[\u0000-\u0020\u007f\\]/.test(decoded);
		} catch { return false; }
	}
	try {
		const parsed = new URL(url);
		if (parsed.username || parsed.password) return false;
		if (parsed.protocol === 'https:') return true;
		return parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
	} catch {
		return false;
	}
}

const imageUrl = z.string().trim().min(1).max(2048).refine(isAllowedAppearanceUrl, 'Нужен внутренний путь или HTTPS URL');

export const siteAppearanceUpdateSchema = z
	.object({
		appLogoUrl: imageUrl.optional(),
		dotaLogoUrl: imageUrl.optional(),
		mobileBackdropUrl: imageUrl.optional(),
		homeCoverUrl: imageUrl.optional(),
		motionEnabled: z.boolean().optional(),
		backdropOpacity: z.number().int().min(8).max(45).optional(),
		backdropPositionY: z.number().int().min(0).max(100).optional()
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, 'Нет изменений');

export function appearanceMediaUrl(storage: AppearanceStorageKind, key: string) {
	const encodedKey = key
		.split('/')
		.filter(Boolean)
		.map((part) => encodeURIComponent(part))
		.join('/');
	return `/api/media/appearance/${storage}/${encodedKey}`;
}

export function detectAppearanceImage(bytes: Uint8Array) {
	if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
		return { contentType: 'image/png', extension: 'png' };
	}
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return { contentType: 'image/jpeg', extension: 'jpg' };
	}
	const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
	if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
		return { contentType: 'image/webp', extension: 'webp' };
	}
	if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(ascii(0, 6))) {
		return { contentType: 'image/gif', extension: 'gif' };
	}
	if (bytes.length >= 12 && ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12))) {
		return { contentType: 'image/avif', extension: 'avif' };
	}
	return null;
}
