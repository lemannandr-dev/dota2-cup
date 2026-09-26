import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret() {
	return encodeBase32(randomBytes(20));
}

export function totpAuthUrl(secret: string, account: string) {
	const label = encodeURIComponent(`Aegis Arena:${account}`);
	return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent('Aegis Arena')}&digits=6&period=30`;
}

export function totpCode(secret: string, at = Date.now()) {
	const key = decodeBase32(secret);
	const counter = Math.floor(at / 1000 / 30);
	const buf = Buffer.alloc(8);
	buf.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0);
	buf.writeUInt32BE(counter >>> 0, 4);
	const hmac = createHmac('sha1', key).update(buf).digest();
	const offset = hmac[hmac.length - 1] & 0xf;
	const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
	return String(bin % 1_000_000).padStart(6, '0');
}

export function verifyTotp(secret: string, code: string, at = Date.now(), window = 1) {
	const expected = String(code ?? '').replace(/\s/g, '');
	if (!/^\d{6}$/.test(expected)) return false;
	for (let i = -window; i <= window; i++) {
		const candidate = totpCode(secret, at + i * 30_000);
		const left = Buffer.from(candidate);
		const right = Buffer.from(expected);
		if (left.length === right.length && timingSafeEqual(left, right)) return true;
	}
	return false;
}

function encodeBase32(bytes: Buffer) {
	let bits = 0;
	let value = 0;
	let out = '';
	for (const byte of bytes) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			out += ALPHABET[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
	return out;
}

function decodeBase32(secret: string) {
	const clean = secret.replace(/=+$/g, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
	let bits = 0;
	let value = 0;
	const out: number[] = [];
	for (const char of clean) {
		const idx = ALPHABET.indexOf(char);
		if (idx < 0) continue;
		value = (value << 5) | idx;
		bits += 5;
		if (bits >= 8) {
			out.push((value >>> (bits - 8)) & 255);
			bits -= 8;
		}
	}
	return Buffer.from(out);
}
