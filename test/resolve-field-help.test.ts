import { describe, it, expect } from 'vitest';
import { resolveFieldHelp } from '../src/lib/components/forms/resolve-field-help.js';

const id = (k: string) => k;

describe('resolveFieldHelp', () => {
	it('returns null for undefined help', () => {
		expect(resolveFieldHelp(undefined, 'form', id)).toBeNull();
	});

	it('meta path: resolves when tooltip present and surface flag open', () => {
		const r = resolveFieldHelp(
			{ tooltip: 'k.tip', tooltip_title: 'k.title', tooltip_priority: 'HINT' },
			'form',
			id,
		);
		expect(r).toEqual({ text: 'k.tip', title: 'k.title', priority: 'HINT', labelKey: undefined });
	});

	it('meta path: gates on show_form_tooltip in form context', () => {
		expect(
			resolveFieldHelp({ tooltip: 'k', show_form_tooltip: false }, 'form', id),
		).toBeNull();
		expect(
			resolveFieldHelp({ tooltip: 'k', show_form_tooltip: false }, 'list', id),
		).not.toBeNull();
	});

	it('meta path: gates on show_list_tooltip in list context', () => {
		expect(
			resolveFieldHelp({ tooltip: 'k', show_list_tooltip: false }, 'list', id),
		).toBeNull();
		expect(
			resolveFieldHelp({ tooltip: 'k', show_list_tooltip: false }, 'form', id),
		).not.toBeNull();
	});

	it('meta path: tooltip_title/priority without tooltip resolves null', () => {
		expect(
			resolveFieldHelp(
				{ tooltip_title: 'k.t', tooltip_priority: 'WARNING' },
				'form',
				id,
			),
		).toBeNull();
	});

	it('ghost-icon guard: meta-shaped object lacking tooltip* keys resolves null', () => {
		// A MetaColumn like {key:'id', label_key:..., type:'text'} falls into the
		// FieldHelp branch — every member undefined must NOT render an icon.
		expect(
			resolveFieldHelp(
				{ key: 'id', label_key: 'x', type: 'text' } as never,
				'form',
				id,
			),
		).toBeNull();
	});

	it('ghost-icon guard: empty pre-mapped FieldHelp resolves null', () => {
		expect(resolveFieldHelp({} as never, 'form', id)).toBeNull();
	});

	it('pre-mapped: text-only resolves (tooltip body)', () => {
		expect(resolveFieldHelp({ text: 'body' }, 'form', id)).toEqual({
			text: 'body',
			title: undefined,
			priority: undefined,
			labelKey: undefined,
		});
	});

	it('pre-mapped: labelKey-only resolves (marker + qualifier contract)', () => {
		expect(resolveFieldHelp({ labelKey: 'k' }, 'form', id)).not.toBeNull();
	});

	it('pre-mapped: priority-only resolves (severity marker contract)', () => {
		expect(resolveFieldHelp({ priority: 'WARNING' }, 'form', id)).not.toBeNull();
	});
});
