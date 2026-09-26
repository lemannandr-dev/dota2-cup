import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { appearanceMediaUrl, type AppearanceAssetField, type AppearanceStorageKind } from '@/lib/site-appearance';
import { getPrivateObject, putPrivateObject } from '@/server/storage/s3';

const fieldFolders: Record<AppearanceAssetField, string> = {
	appLogoUrl: 'app-logo',
	dotaLogoUrl: 'dota-logo',
	mobileBackdropUrl: 'backdrop',
	homeCoverUrl: 'home-cover'
};

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

export async function storeAppearanceImage(input: {
	field: AppearanceAssetField;
	storage: AppearanceStorageKind;
	bytes: Buffer;
	contentType: string;
	extension: string;
}) {
	const fileName = `${Date.now()}-${randomBytes(8).toString('hex')}.${input.extension}`;
	const key = `appearance/${fieldFolders[input.field]}/${fileName}`;
	if (input.storage === 's3') {
		await putPrivateObject(key, input.bytes, input.contentType);
	} else {
		const target = localPath(key);
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, input.bytes);
	}
	return { key, url: appearanceMediaUrl(input.storage, key) };
}

export async function readAppearanceImage(storage: AppearanceStorageKind, pathParts: string[]) {
	const parts = safeKeyParts(pathParts);
	const key = parts.join('/');
	if (!/^appearance\/(app-logo|dota-logo|backdrop|home-cover)\/\d+-[a-f0-9]{16}\.webp$/.test(key)) {
		throw new Error('Invalid media path');
	}
	if (storage === 's3') return getPrivateObject(key);
	const bytes = await readFile(localPath(key));
	const extension = path.extname(key).toLowerCase();
	const contentType =
		extension === '.png'
			? 'image/png'
			: extension === '.webp'
				? 'image/webp'
				: extension === '.gif'
					? 'image/gif'
					: extension === '.avif'
						? 'image/avif'
						: 'image/jpeg';
	return { bytes, contentType };
}
