import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
	CUSTOM_ICONS,
	TABLE_DICTIONARY_NODES,
	TABLE_DICTIONARY_ROWS_NODES,
	TRASH_ARROW_UP_NODES,
	type CustomIconNode,
} from '../src/lib/icons/custom-icons.js';

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

describe('table-dictionary authored geometry', () => {
	it('keeps the approved path set verbatim (table construction, column split at x=10.5 → 7.5u/10.5u)', () => {
		expect(TABLE_DICTIONARY_NODES).toEqual([
			['path', { d: 'M10.5 3v18' }],
			['rect', { width: 18, height: 18, x: 3, y: 3, rx: 2 }],
			['path', { d: 'M3 9h18' }],
			['path', { d: 'M3 15h18' }],
		]);
	});

	it('keeps every coordinate on the half-unit grid — .5 is upstream-conformant', () => {
		for (const n of pathNumbers(TABLE_DICTIONARY_NODES)) {
			expect(Number.isInteger(n * 2), `sub-half-pixel coordinate ${n}`).toBe(true);
		}
	});
});

describe('table-dictionary-rows authored geometry', () => {
	it('keeps the approved path set verbatim (3 detached h=4 rows y=3/10/17, code x3w6 + label x12w9 per row)', () => {
		expect(TABLE_DICTIONARY_ROWS_NODES).toEqual([
			['rect', { x: 3, y: 3, width: 6, height: 4, rx: 1 }],
			['rect', { x: 12, y: 3, width: 9, height: 4, rx: 1 }],
			['rect', { x: 3, y: 10, width: 6, height: 4, rx: 1 }],
			['rect', { x: 12, y: 10, width: 9, height: 4, rx: 1 }],
			['rect', { x: 3, y: 17, width: 6, height: 4, rx: 1 }],
			['rect', { x: 12, y: 17, width: 9, height: 4, rx: 1 }],
		]);
	});

	it('keeps every coordinate on the integer grid', () => {
		for (const n of pathNumbers(TABLE_DICTIONARY_ROWS_NODES)) {
			expect(Number.isInteger(n), `non-integer coordinate ${n}`).toBe(true);
		}
	});
});
