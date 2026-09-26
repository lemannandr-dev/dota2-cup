import { describe, expect, it } from 'vitest';
import { buildCupHighlights, parseCupHighlight, parseHighlightLines } from '@/lib/cup-highlights';

describe('cup highlights', () => {
	it('keeps only https media urls and embeds YouTube', () => {
		expect(parseHighlightLines('http://evil.test\nhttps://youtu.be/dQw4w9wgCcc')).toEqual(['https://youtu.be/dQw4w9wgCcc']);
		const clip = parseCupHighlight('https://www.youtube.com/watch?v=dQw4w9wgCcc');
		expect(clip?.kind).toBe('youtube');
		expect(clip?.embed).toContain('dQw4w9wgCcc');
	});

	it('does not invent a highlight when the org left the list empty', () => {
		expect(buildCupHighlights({ urls: [] })).toEqual([]);
		expect(buildCupHighlights({}).map((row) => row.kind)).toEqual([]);
	});
});
