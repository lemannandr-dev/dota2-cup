import sharp from 'sharp';
import { detectAppearanceImage, MAX_APPEARANCE_IMAGE_BYTES, type AppearanceAssetField } from '@/lib/site-appearance';
import { DomainError } from '@/server/errors';

export async function normalizeAppearanceImage(bytes: Buffer, field: AppearanceAssetField) {
	if (bytes.length === 0 || bytes.length > MAX_APPEARANCE_IMAGE_BYTES || !detectAppearanceImage(bytes)) {
		throw new DomainError('Нужен PNG, JPEG, WebP, GIF или AVIF до 10 МБ');
	}
	try {
		const size = field === 'appLogoUrl' || field === 'dotaLogoUrl' ? 512 : 1920;
		// Decode and re-encode pixels, discarding metadata and extra animation frames.
		// Motion is applied by the UI so it respects reduced-motion preferences.
		const output = await sharp(bytes, { limitInputPixels: 24_000_000, failOn: 'warning', pages: 1 })
			.rotate()
			.resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
			.webp({ quality: 84 })
			.toBuffer();
		return { bytes: output, contentType: 'image/webp', extension: 'webp' };
	} catch {
		throw new DomainError('Не удалось прочитать изображение. Максимум 24 мегапикселя, файл не должен быть повреждён.');
	}
}
