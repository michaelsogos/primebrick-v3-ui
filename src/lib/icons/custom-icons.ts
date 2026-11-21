/**
 * Custom icon registry — lucide-vocabulary single glyphs AUTHORED by
 * Primebrick (24×24 grid, stroke 2, round caps/joins, `currentColor`):
 * icons our domain needs that lucide doesn't ship, drawn to lucide's own
 * guidelines so each stays a candidate for upstream contribution. The
 * node tuples ARE the lucide `icons/<name>.json` payload format — the
 * array below copies verbatim into the contribution PR; once lucide
 * ships the same name the entry is dropped and the glob resolves the
 * upstream glyph identically.
 *
 * `DynamicIcon` resolves this registry AFTER `SEMANTIC_ICONS` and
 * `COMPOSED_ICONS`, BEFORE the lucide glob — a custom name must never
 * collide with a lucide icon name (pinned by `test/custom-icons.test.ts`),
 * and unlike `SEMANTIC_ICONS` these glyphs are color-neutral: any
 * `ActionColor` chrome may pair with them (`validateActionChrome` does
 * not bind them).
 */

/** Node tuple — mirrors lucide's `IconNode` shape `[tag, attrs]` (the
 *  same shape `COMPOSED_ICONS.overlay_nodes` already uses). */
export type CustomIconNode = Array<[string, Record<string, string | number>]>;

/** trash-arrow-up — "restore from deleted": the lucide `trash` bin minus
 *  its two inner verticals, the bottom edge split around x=12 with an
 *  8-unit gap (the `archive-arrow-up`/`square-arrow-*-enter` edge-interrupt
 *  construction), and the canonical lucide up-arrow (`m9 15 3-3 3 3`
 *  chevron + shaft) centered on it — the shaft lands exactly on the
 *  baseline, reading as the row coming back OUT of the bin. Name follows
 *  the upstream convention: lucide deprecated `archive-restore` in favour
 *  of `archive-arrow-up` — icon names describe the shape, tags the
 *  semantics. */
export const TRASH_ARROW_UP_NODES: CustomIconNode = [
  ['path', { d: 'M3 6h18' }],
  ['path', { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }],
  ['path', { d: 'M5 6v14a2 2 0 0 0 2 2h1' }],
  ['path', { d: 'M19 6v14a2 2 0 0 1-2 2h-1' }],
  ['path', { d: 'm9 15 3-3 3 3' }],
  ['path', { d: 'M12 12v10' }],
];

/** question-mark — the bare "?" glyph (arc + dot). Upstream lucide ships
 *  this name from 1.72.0; the pinned `@lucide/svelte` 1.70.0 predates it
 *  and only carries the composed variants (`circle-/badge-/message-…`).
 *  Node tuple copied verbatim from `lucide-static/icons/question-mark.svg`
 *  (ISC) — drop this entry once the pinned dep ships the name and the
 *  no-collision test flags it. */
export const QUESTION_MARK_NODES: CustomIconNode = [
  ['path', { d: 'M12 15c0-2.48 5-2.99 5-6.5a5 4.5 0 00-10 0' }],
  ['path', { d: 'M12 20h.01' }],
];

/** table-dictionary — the `table` construction (rect + header row + row
 *  divider) with the column split moved to x=10.5: 7.5u narrow `code`
 *  column / 10.5u wide `label` column ≈ 42/58 — the dict row anatomy
 *  (`table` splits 50/50 at x=12, `table-properties` 67/33 at x=15). The
 *  half-pixel coordinate is upstream-conformant — hundreds of lucide
 *  glyphs carry `.5` values. */
export const TABLE_DICTIONARY_NODES: CustomIconNode = [
  ['path', { d: 'M10.5 3v18' }],
  ['rect', { width: 18, height: 18, x: 3, y: 3, rx: 2 }],
  ['path', { d: 'M3 9h18' }],
  ['path', { d: 'M3 15h18' }],
];

/** list-dictionary — the dict rows DETACHED: the continuous grid of
 *  `table-dictionary` becomes three independent `h=4` rows at y=3/10/17
 *  (3px gaps, the only symmetric integer decomposition of the 18u field),
 *  each split into a code cell (`x3 w6`) and a label cell (`x12 w9`) with a
 *  real 3px column gap — 6/9 keeps the parent's exact 40/60 split while the
 *  uniform 3px gaps read "rows, not a table". Name follows the upstream
 *  `list-*` subject-qualifier family (`list-todo`, `list-music`): a list
 *  of dictionary entries — `table` would misdescribe the detached shape,
 *  `book-*` is a different vocabulary. All-integer coords. Submitted
 *  upstream as PR lucide-icons/lucide#5270. */
export const LIST_DICTIONARY_NODES: CustomIconNode = [
  ['rect', { x: 3, y: 3, width: 6, height: 4, rx: 1 }],
  ['rect', { x: 12, y: 3, width: 9, height: 4, rx: 1 }],
  ['rect', { x: 3, y: 10, width: 6, height: 4, rx: 1 }],
  ['rect', { x: 12, y: 10, width: 9, height: 4, rx: 1 }],
  ['rect', { x: 3, y: 17, width: 6, height: 4, rx: 1 }],
  ['rect', { x: 12, y: 17, width: 9, height: 4, rx: 1 }],
];

/** sequence-numeric-right — "1 › N →": an ordered progression from the
 *  first to the nth item — the numeric-sequencer glyph. The
 *  `layout-arrow-right` construction (arrow kept verbatim at stroke 2)
 *  with its two squares replaced by a numeric sequence at stroke 1.5:
 *  "1" as a diagonal-flag stem (no foot), "N" in the `arrow-down-a-z`
 *  geometric letter style (two stems + diagonal), and a `>` chevron
 *  apex-centred at cy=7.5 — the exact mid-height of the h5 glyphs —
 *  with equal ~4u gaps between tokens (group x3.5–20.5, the same span
 *  as the arrow). The two-weight construction is a deliberate
 *  Primebrick deviation from upstream's uniform stroke 2. Coordinates
 *  sit on the half-unit grid. Name follows the shape-based upstream
 *  convention: subject (`sequence-numeric`) + direction qualifier
 *  (`-right`). */
export const SEQUENCE_NUMERIC_RIGHT_NODES: CustomIconNode = [
  ['path', { d: 'm3.5 6.5 1.5-1.5V10', 'stroke-width': 1.5 }],
  ['path', { d: 'm9.5 10 2.5-2.5-2.5-2.5', 'stroke-width': 1.5 }],
  ['path', { d: 'M16 10V5l4.5 5V5', 'stroke-width': 1.5 }],
  ['path', { d: 'M3 18h18' }],
  ['path', { d: 'm18 21 3-3-3-3' }],
];

export const CUSTOM_ICONS: Partial<Record<string, CustomIconNode>> = {
  'trash-arrow-up': TRASH_ARROW_UP_NODES,
  'question-mark': QUESTION_MARK_NODES,
  'table-dictionary': TABLE_DICTIONARY_NODES,
  'list-dictionary': LIST_DICTIONARY_NODES,
  'sequence-numeric-right': SEQUENCE_NUMERIC_RIGHT_NODES,
};
