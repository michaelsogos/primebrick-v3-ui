import { describe, expect, it } from 'vitest';
import { parseIconName } from '../src/lib/icons/icon-qualifiers.js';

describe('parseIconName — :filled qualifier', () => {
	it('strips the suffix and flags filled', () => {
		expect(parseIconName('pause:filled')).toEqual({ name: 'pause', filled: true });
	});

	it('passes a bare name through untouched', () => {
		expect(parseIconName('pause')).toEqual({ name: 'pause', filled: false });
	});

	it('explicit prop ORs with the suffix', () => {
		expect(parseIconName('play', true)).toEqual({ name: 'play', filled: true });
	});

	it('only matches a trailing qualifier — other names pass through', () => {
		expect(parseIconName('file-cog')).toEqual({ name: 'file-cog', filled: false });
	});
});
