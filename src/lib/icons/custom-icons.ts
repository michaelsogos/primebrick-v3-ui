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

export const CUSTOM_ICONS: Partial<Record<string, CustomIconNode>> = {
  'trash-arrow-up': TRASH_ARROW_UP_NODES,
};
