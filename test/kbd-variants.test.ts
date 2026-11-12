import { describe, expect, it } from 'vitest';
import { kbdVariants } from '../src/lib/components/kbd/kbd-variants.js';

describe('kbdVariants', () => {
	it('emits every declared size', () => {
		expect(kbdVariants({ size: 'key' })).toContain('h-5');
		expect(kbdVariants({ size: 'modifier' })).toContain('h-5');
		expect(kbdVariants({ size: 'icon' })).toContain('size-5');
		expect(kbdVariants({ size: 'key-lg' })).toContain('h-6');
		expect(kbdVariants({ size: 'modifier-lg' })).toContain('h-6');
		expect(kbdVariants({ size: 'icon-lg' })).toContain('size-6');
	});

	it('tone inverted emits the solid dark-surface chip', () => {
		// Regression: a variant axis defined outside `variants` is silently
		// ignored by tailwind-variants — this asserts the axis is live.
		expect(kbdVariants({ tone: 'inverted' })).toContain('bg-muted');
	});

	it('default tone changes nothing', () => {
		expect(kbdVariants({})).toBe(kbdVariants({ tone: 'default' }));
	});
});
