import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { detectTeamCover, teamCoverMediaUrl, type DetectedTeamCover } from '@/lib/team-cover';
import { DomainError } from '@/server/errors';
import { getPrivateObject, putPrivateObject, s3Configured } from '@/server/storage/s3';

export type TeamCoverStorage = 'local' | 's3';

function localRoot() {
	return path.resolve(process.env.LOCAL_MEDIA_DIR || path.join(process.cwd(), '.data', 'media'));
}

function safeKeyParts(parts: string[]) {
	if (parts.length === 0 || parts.some((part) => !/^[a-zA-Z0-9._-]+$/.test(part) || part === '.' || part === '..')) {
		throw new Error('Invalid media path');
	}
	return parts;
}

function localPath(key: string) {
	const parts = safeKeyParts(key.split('/').filter(Boolean));
	const root = localRoot();
	const target = path.resolve(root, ...parts);
	if (!target.startsWith(`${root}${path.sep}`)) throw new Error('Invalid media path');
	return target;
}

const KEY = /^teams\/[a-z0-9]+\/[a-f0-9]{16}\.(webp|mp4|webm)$/i;

export function preferredTeamCoverStorage(): TeamCoverStorage {
	return s3Configured() ? 's3' : 'local';
}

/** Decode and re-encode stills and GIFs. Animation survives as WebP; metadata and extra chunks do not. */
export async function normalizeTeamImage(bytes: Buffer, slot: 'logo' | 'cover', detected: DetectedTeamCover) {
	if (detected.kind !== 'image') throw new DomainError('Для знака нужен PNG, JPEG, WebP или GIF');
	const animated = detected.extension === 'gif';
	const size = slot === 'logo' ? 512 : 1280;
	try {
		const output = await sharp(bytes, {
			animated,
			pages: animated ? 40 : 1,
			limitInputPixels: 24_000_000,
			failOn: 'error'
		})
			.rotate()
			.resize({ width: size, height: slot === 'logo' ? size : 720, fit: 'inside', withoutEnlargement: true })
			.webp({ quality: animated ? 74 : 82, effort: 4 })
			.toBuffer();
		if (output.length === 0 || output.length > 4 * 1024 * 1024) {
			throw new DomainError('После проверки файл слишком большой');
		}
		return output;
	} catch (error) {
		if (error instanceof DomainError) throw error;
		throw new DomainError('Не удалось прочитать изображение. Файл повреждён или это не картинка.');
	}
}

export async function storeTeamCover(input: {
	teamId: string;
	bytes: Buffer;
	contentType: string;
	extension: 'webp' | 'mp4' | 'webm';
	storage: TeamCoverStorage;
}) {
	if (!/^[a-z0-9]+$/i.test(input.teamId)) throw new DomainError('Некорректная команда');
	const fileName = `${randomBytes(8).toString('hex')}.${input.extension}`;
	const key = `teams/${input.teamId}/${fileName}`;
	if (!KEY.test(key)) throw new DomainError('Некорректный путь файла');
	if (input.storage === 's3') await putPrivateObject(key, input.bytes, input.contentType);
	else {
		const target = localPath(key);
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, input.bytes);
	}
	return { key, url: teamCoverMediaUrl(input.storage, key) };
}

export async function readTeamCover(storage: TeamCoverStorage, pathParts: string[]) {
	const parts = safeKeyParts(pathParts);
	const key = parts.join('/');
	if (!KEY.test(key)) throw new Error('Invalid media path');
	const extension = path.extname(key).toLowerCase();
	const contentType = extension === '.mp4' ? 'video/mp4' : extension === '.webm' ? 'video/webm' : 'image/webp';
	if (storage === 's3') {
		const object = await getPrivateObject(key);
		return { bytes: object.bytes, contentType };
	}
	return { bytes: await readFile(localPath(key)), contentType };
}
