export const MAX_TEAM_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_TEAM_VIDEO_BYTES = 8 * 1024 * 1024;

export type TeamCoverKind = 'image' | 'video';

export type DetectedTeamCover = {
	kind: TeamCoverKind;
	contentType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'video/mp4' | 'video/webm';
	extension: 'png' | 'jpg' | 'webp' | 'gif' | 'mp4' | 'webm';
};

function ascii(bytes: Uint8Array, start: number, end: number) {
	return String.fromCharCode(...bytes.slice(start, end));
}

/** Identify a cover by magic bytes. SVG, HTML and unknown files are rejected. */
export function detectTeamCover(bytes: Uint8Array): DetectedTeamCover | null {
	if (bytes.length < 12) return null;
	const head = ascii(bytes, 0, Math.min(bytes.length, 64)).trim().toLowerCase();
	if (head.startsWith('<') || head.includes('<svg') || head.includes('<script') || head.includes('<!doctype')) return null;
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
		return { kind: 'image', contentType: 'image/png', extension: 'png' };
	}
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return { kind: 'image', contentType: 'image/jpeg', extension: 'jpg' };
	}
	if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
		return { kind: 'image', contentType: 'image/webp', extension: 'webp' };
	}
	if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a') {
		return { kind: 'image', contentType: 'image/gif', extension: 'gif' };
	}
	if (ascii(bytes, 4, 8) === 'ftyp') {
		return { kind: 'video', contentType: 'video/mp4', extension: 'mp4' };
	}
	if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
		return { kind: 'video', contentType: 'video/webm', extension: 'webm' };
	}
	return null;
}

export function teamCoverLimit(kind: TeamCoverKind) {
	return kind === 'video' ? MAX_TEAM_VIDEO_BYTES : MAX_TEAM_IMAGE_BYTES;
}

export function teamCoverMediaUrl(storage: 'local' | 's3', key: string) {
	const encodedKey = key
		.split('/')
		.filter(Boolean)
		.map((part) => encodeURIComponent(part))
		.join('/');
	return `/api/media/team-cover/${storage}/${encodedKey}`;
}

export function isHostedTeamVideo(url: string | null | undefined) {
	return Boolean(url && url.startsWith('/api/media/team-cover/') && /\.(mp4|webm)$/i.test(url.split('?')[0] ?? ''));
}
