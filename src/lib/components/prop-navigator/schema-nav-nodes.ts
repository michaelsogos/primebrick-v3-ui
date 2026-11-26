/**
 * schema → PropNavNode tree — the ONE canonical builder shared by every
 * schema-driven navigator (payload-map source paths, rule-filter field
 * picker, any future consumer). Owns the three presentation contracts so
 * two pickers can never diverge again:
 *
 *   - `label` resolves `x_label_key` through the host `t` bridge, raw key
 *     as honest fallback;
 *   - `_sub` is a readable type line — `format` when declared, the enum
 *     vocabulary, the `const` literal, `array<items>` — never a bare
 *     `string` when the schema says more, never `unknown` for consts;
 *   - `_icon`/`_icon_dashed` follow the format-over-type icon map
 *     (`email`→mail, `actor_token`→user-cog…); nullable unions carry the
 *     base icon dashed.
 *
 * Sibling order is ALPHABETICAL BY RESOLVED LABEL at every column —
 * schema-declaration order is meaningless to an author (user decision
 * 2026-12-21).
 */
import { get } from 'svelte/store';
import { getT } from '../../bridges.js';
import { PAYLOAD_X_SEMANTIC, columnSchemaLeaf, type MetaColumn } from '@primebrick/core';
import type { PropNavNode } from './prop-nav.types.js';

export interface SchemaLike {
	type?: string | string[];
	format?: string;
	enum?: unknown[];
	const?: unknown;
	items?: SchemaLike;
	properties?: Record<string, SchemaLike>;
	x_label_key?: string;
	[key: string]: unknown;
}

const FORMAT_TYPE_ICONS: Record<string, string> = {
	email: 'mail',
	url: 'link',
	uri: 'link',
	uuid: 'file-key',
	'date-time': 'calendar-clock',
	datetime: 'calendar-clock',
	actor_token: 'user-cog',
	date: 'calendar',
	time: 'clock',
	phone: 'phone',
	color_hex: 'palette',
	lang: 'languages',
	// cadence family — scheduler and reviver share the ONE glyph
	// (user-ratified convention: same icon as the widgets' assist CTA).
	schedule_spec: 'clipboard-clock',
	revive_interval: 'clipboard-clock',
	revive_offset: 'clipboard-clock',
	// i18n vocabulary — the same glyph the key combobox options carry.
	i18n_key: 'languages',
};
/** Runtime type name of a JSON literal — `2`→number, `"x"`→string. */
function literalKind(v: unknown): string {
	if (v === null) return 'null';
	if (typeof v === 'number') return 'number';
	if (typeof v === 'boolean') return 'boolean';
	return 'string';
}

const TYPE_ICONS: Record<string, string> = {
	string: 'type',
	number: 'hash',
	integer: 'hash',
	bigint: 'hash',
	boolean: 'toggle-left',
	array: 'brackets',
	object: 'braces',
	null: 'circle-slash',
};

/** `{ _icon, _icon_dashed? }` for a schema node — the declared format wins
 *  over the bare type; `x_semantic:"actor.uuid"` renders the actor glyph
 *  (META family), not a bare file-key. `null` in a type union flags the
 *  base icon as dashed rather than picking a "null" glyph. */
export function schemaTypeIcon(schema: SchemaLike | undefined): {
	_icon: string;
	_icon_dashed?: boolean;
} {
	const raw = schema?.type;
	const types = Array.isArray(raw) ? raw.map(String) : raw !== undefined ? [String(raw)] : [];
	const nullable = types.includes('null');
	const base = types.find((x) => x !== 'null');
	let icon: string | undefined;
	if (schema?.[PAYLOAD_X_SEMANTIC] === 'actor.uuid') icon = 'user-cog';
	if (!icon && typeof schema?.format === 'string') icon = FORMAT_TYPE_ICONS[schema.format];
	if (!icon && Array.isArray(schema?.enum) && schema.enum.length > 0) icon = 'tags';
	// `const`/`type`-less leaves: the literal's runtime type IS the icon —
	// no jargon glyph for a wire constraint the author never sees.
	if (!icon && schema && 'const' in schema) icon = TYPE_ICONS[literalKind(schema.const)];
	if (!icon && base) icon = TYPE_ICONS[base];
	if (!icon) icon = 'circle-question-mark';
	return nullable ? { _icon: icon, _icon_dashed: true } : { _icon: icon };
}

/** `options_source` vocabularies whose VALUE SEMANTIC owns a type glyph —
 *  the same icon the vocabulary's option rows carry in the picking
 *  combobox (`iana.tzones` rows render `globe` in the dispatcher, so the
 *  column's type icon IS the globe — user-ratified 2026-11-26). A bare
 *  `text` type glyph would lie about what the value is. */
const OPTIONS_SOURCE_TYPE_ICONS: Record<string, string> = {
	'iana.tzones': 'globe',
};

/**
 * metaColumnIcon — the ONE canonical icon derivation for a metadata column
 * in a PICKER surface (field selectors, criteria builders, column menus).
 * Precedence: the declared metadata `icon` wins when the author set one;
 * a governed `options_source` vocabulary with its own semantic glyph comes
 * next (the value IS a timezone/a role/…, never bare text); otherwise the
 * glyph derives from the column's wire shape via `schemaTypeIcon(
 * columnSchemaLeaf(col))` — format over type, badge vocabularies as tags,
 * refs as file-keys. Composing the two helpers by hand at every consumer
 * is exactly how the filters panel shipped without icons (user-reported
 * 2026-11-26) — the derivation is enforced here at construction.
 *
 * In-place decoration (table headers, form labels, criterion summaries)
 * keeps the declared-only semantic — a type glyph there is noise, not
 * affordance.
 */
export function metaColumnIcon(
	col: Pick<MetaColumn, 'type' | 'icon'> &
		Partial<Pick<MetaColumn, 'format' | 'nullable' | 'badge' | 'options_source'>>,
): string {
	return (
		col.icon ??
		(col.options_source ? OPTIONS_SOURCE_TYPE_ICONS[col.options_source] : undefined) ??
		schemaTypeIcon(columnSchemaLeaf(col))._icon
	);
}

/** Readable type line — honest about the shape, never a bare `string`
 *  when the schema declares more: a `format` IS the type (`lang`,
 *  `email`, `date-time`), arrays unwrap to `array<email>`, a `const` IS
 *  the literal. An enum's TYPE is its literals' runtime type (`string`)
 *  — the vocabulary lives in the value picker (tags icon), not in the
 *  type line. */
export function schemaLeafSub(sub: SchemaLike | undefined): string {
	const raw = sub?.type;
	const types = Array.isArray(raw) ? raw.map(String) : raw !== undefined ? [String(raw)] : [];
	const base = types.find((x) => x !== 'null');
	if (base === 'array') return `array<${sub?.items ? schemaLeafSub(sub.items) : 'unknown'}>`;
	if (typeof sub?.format === 'string') return sub.format;
	if (Array.isArray(sub?.enum)) {
		const kinds = new Set(sub.enum.map(literalKind));
		return kinds.size === 1 ? [...kinds][0] : 'enum';
	}
	// `const` — the TYPE is the literal's kind; the pinned value lives in
	// the value picker (like enum vocabulary), not in the type line.
	if (sub && 'const' in sub) return literalKind(sub.const);
	return base ?? 'unknown';
}

/** The navigable tree — `value` carries the full wire path, `children`
 *  mirror `properties`, `_schema` stays on the node for compat screening.
 *  Sorted by resolved label at every level. */
export function schemaToNavNodes(
	schema: SchemaLike | undefined,
	opts: { prefix?: string; depth?: number; maxDepth?: number } = {},
): PropNavNode[] {
	const prefix = opts.prefix ?? '$';
	const depth = opts.depth ?? 1;
	const maxDepth = opts.maxDepth ?? 5;
	if (!schema?.properties || depth > maxDepth) return [];
	// The i18n bridge is bound at app boot — resolve it per call, never at
	// module scope (an import-time getT() runs before the host binds).
	const t = get(getT());
	return Object.entries(schema.properties)
		.map(([key, sub]) => {
			const path = `${prefix}.${key}`;
			const children = schemaToNavNodes(sub, { prefix: path, depth: depth + 1, maxDepth });
			const labelKey = sub?.x_label_key;
			return {
				value: path,
				label: typeof labelKey === 'string' && labelKey ? t(labelKey) : key,
				_sub: schemaLeafSub(sub),
				_schema: sub as Record<string, unknown>,
				...schemaTypeIcon(sub),
				...(children.length > 0 ? { children } : {}),
			} satisfies PropNavNode;
		})
		.sort((a, b) => String(a.label).localeCompare(String(b.label)));
}
