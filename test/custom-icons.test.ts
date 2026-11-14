import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CUSTOM_ICONS, TRASH_ARROW_UP_NODES, type CustomIconNode } from '../src/lib/icons/custom-icons.js';

const LUCIDE_ICON_NAMES = new Set(
	readdirSync(
		fileURLToPath(new URL('../node_modules/@lucide/svelte/dist/icons', import.meta.url)),
	)
		.filter((f) => f.endsWith('.svelte'))
		.map((f) => f.replace(/\.svelte$/, '')),
);

/** Lucide shape rule: every authored coordinate stays on the integer grid
 *  (no subpixel drift — the glyphs must remain contribution-ready). */
function* pathNumbers(nodes: CustomIconNode): Generator<number> {
	for (const [, attrs] of nodes) {
		for (const value of Object.values(attrs)) {
			for (const m of String(value).matchAll(/-?\d+\.?\d*/g)) yield Number(m[0]);
		}
	}
}

describe('CUSTOM_ICONS registry', () => {
	it('every key resolves to a non-empty node list', () => {
		for (const [name, nodes] of Object.entries(CUSTOM_ICONS)) {
			expect(nodes, `custom icon "${name}" is undefined`).toBeDefined();
			expect(nodes!.length, `custom icon "${name}" has no nodes`).toBeGreaterThan(0);
		}
	});

	it('never collides with a lucide icon name — the glob would shadow it', () => {
		for (const name of Object.keys(CUSTOM_ICONS)) {
			expect(LUCIDE_ICON_NAMES.has(name), `"${name}" now exists in @lucide/svelte — drop the custom glyph and let the glob resolve upstream`).toBe(false);
		}
	});
});

describe('trash-arrow-up authored geometry', () => {
	it('keeps the approved path set verbatim (trash minus inner verticals, 8u baseline gap, canonical up-arrow)', () => {
		expect(TRASH_ARROW_UP_NODES).toEqual([
			['path', { d: 'M3 6h18' }],
			['path', { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }],
			['path', { d: 'M5 6v14a2 2 0 0 0 2 2h1' }],
			['path', { d: 'M19 6v14a2 2 0 0 1-2 2h-1' }],
			['path', { d: 'm9 15 3-3 3 3' }],
			['path', { d: 'M12 12v10' }],
		]);
	});

	it('keeps every coordinate on the integer grid', () => {
		for (const n of pathNumbers(TRASH_ARROW_UP_NODES)) {
			expect(Number.isInteger(n), `non-integer coordinate ${n}`).toBe(true);
		}
	});
});
