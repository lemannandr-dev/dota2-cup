import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { isAllowedAppearanceUrl, siteAppearanceUpdateSchema } from '@/lib/site-appearance';
import { normalizeAppearanceImage } from '@/server/storage/appearance-image';
import { isSameOriginAppearanceRequest, readAppearanceBody } from '@/server/appearance-request';
import { readAppearanceImage } from '@/server/storage/appearance';

describe('appearance input boundaries', () => {
	it('accepts same-site paths, HTTPS and local development URLs', () => {
		for (const url of ['/brand/dota2-heroes.webp', 'https://cdn.example.org/image.webp', 'http://localhost:3002/test.png']) {
			expect(isAllowedAppearanceUrl(url)).toBe(true);
		}
	});
	it('rejects executable, credential-bearing and disguised external URLs', () => {
		for (const url of ['javascript:alert(1)', 'data:image/svg+xml,<svg/>', '//evil.test/a', '/%2fexample.test/a', '/\\evil.test/a', '/%5cevil.test/a', '/\n/evil.test', 'https://user:password@example.test/a', 'http://external.test/a']) {
			expect(isAllowedAppearanceUrl(url), url).toBe(false);
		}
	});
	it('rejects unexpected fields and out-of-range visual settings', () => {
		expect(siteAppearanceUpdateSchema.safeParse({}).success).toBe(false);
		expect(siteAppearanceUpdateSchema.safeParse({ updatedById: 'somebody' }).success).toBe(false);
		expect(siteAppearanceUpdateSchema.safeParse({ backdropOpacity: 100 }).success).toBe(false);
		expect(siteAppearanceUpdateSchema.safeParse({ backdropPositionY: -1 }).success).toBe(false);
		expect(siteAppearanceUpdateSchema.safeParse({ motionEnabled: false, homeCoverUrl: '/brand/dota2-heroes.webp' }).success).toBe(true);
	});
	it('validates the browser-facing origin including mapped port', () => {
		const request = (origin: string) => new Request('http://localhost:3000/api/admin/appearance', {
			headers: { origin, host: 'localhost:3002', 'x-forwarded-proto': 'http' }
		});
		expect(isSameOriginAppearanceRequest(request('http://localhost:3002'))).toBe(true);
		expect(isSameOriginAppearanceRequest(request('http://localhost:3000'))).toBe(false);
		expect(isSameOriginAppearanceRequest(request('https://another.test'))).toBe(false);
	});
	it('caps streamed bodies even without a content-length header', async () => {
		const request = new Request('http://localhost/upload', { method: 'POST', body: '123456789' });
		await expect(readAppearanceBody(request, 5)).rejects.toMatchObject({ status: 413 });
	});
	it('cannot serve evidence objects or escape the appearance folder', async () => {
		await expect(readAppearanceImage('s3', ['disputes', 'secret.jpg'])).rejects.toThrow('Invalid media path');
		await expect(readAppearanceImage('local', ['appearance', '..', '.env'])).rejects.toThrow('Invalid media path');
	});
});

describe('appearance image processing', () => {
	it('decodes, resizes and re-encodes a real image for mobile', async () => {
		const input = await sharp({ create: { width: 1000, height: 600, channels: 4, background: '#cc333380' } }).png().toBuffer();
		const output = await normalizeAppearanceImage(input, 'appLogoUrl');
		const meta = await sharp(output.bytes).metadata();
		expect(meta.format).toBe('webp');
		expect(meta.width).toBe(512);
		expect(meta.hasAlpha).toBe(true);
		expect(meta.exif).toBeUndefined();
	});
	it('rejects a fake PNG with a valid magic prefix and corrupt pixel data', async () => {
		await expect(normalizeAppearanceImage(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]), 'homeCoverUrl')).rejects.toMatchObject({ status: 400 });
	});
	it('rejects SVG and empty files', async () => {
		await expect(normalizeAppearanceImage(Buffer.from('<svg onload="alert(1)"/>'), 'dotaLogoUrl')).rejects.toMatchObject({ status: 400 });
		await expect(normalizeAppearanceImage(Buffer.alloc(0), 'dotaLogoUrl')).rejects.toMatchObject({ status: 400 });
	});
});
