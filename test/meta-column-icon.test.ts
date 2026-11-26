import { describe, it, expect } from 'vitest';
import { metaColumnIcon } from '../src/lib/components/prop-navigator/schema-nav-nodes.js';

const col = (over: Record<string, unknown> = {}) => ({
	type: 'text',
	key: 'k',
	label_key: 'l',
	order: 0,
	...over,
}) as Parameters<typeof metaColumnIcon>[0];

describe('metaColumnIcon', () => {
	it('declared metadata icon always wins', () => {
		expect(metaColumnIcon(col({ icon: 'star', options_source: 'iana.tzones' }))).toBe('star');
	});
	it('iana.tzones vocabulary owns the globe glyph — never the bare text T (user-ratified)', () => {
		expect(metaColumnIcon(col({ options_source: 'iana.tzones' }))).toBe('globe');
	});
	it('plain text falls to the type-derived glyph', () => {
		expect(metaColumnIcon(col())).toBe('type');
	});
	it('datetime format wins over bare type through the leaf', () => {
		expect(metaColumnIcon(col({ type: 'datetime' }))).toBe('calendar-clock');
	});
	it('unknown options_source falls through to the type glyph', () => {
		expect(metaColumnIcon(col({ options_source: 'census.emits' }))).toBe('type');
	});
	it('i18n_key format carries the languages glyph — same as the key combobox options', () => {
		expect(metaColumnIcon(col({ format: 'i18n_key' }))).toBe('languages');
	});
	it('revive_interval format carries the clipboard-clock cadence glyph — never bare text', () => {
		expect(metaColumnIcon(col({ format: 'revive_interval' }))).toBe('clipboard-clock');
	});
	it('schedule_spec and revive_offset share the same cadence glyph (ratified convention)', () => {
		expect(metaColumnIcon(col({ format: 'schedule_spec' }))).toBe('clipboard-clock');
		expect(metaColumnIcon(col({ format: 'revive_offset' }))).toBe('clipboard-clock');
	});
});
