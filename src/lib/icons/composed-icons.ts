/**
 * Composed icon registry — mashups of TWO lucide glyphs rendered as one
 * icon, mirroring the lucide composite convention (`file-cog` = file +
 * cog badge bottom-right). Lucide only ships the composites its authors
 * designed; names our domain needs (`activity-cog`) are declared HERE so
 * consumers write `name="activity-cog"` like any other icon — DynamicIcon
 * resolves the registry before the single-glyph glob. Pure declarations,
 * no component-specific hardcode.
 *
 * `overlay` renders a full lucide icon at ~55% size anchored bottom-right.
 * `overlay_nodes` renders raw lucide path geometry — used when the badge
 * must match a SPECIFIC composite's sub-glyph (e.g. the thin-spoked gear
 * lucide draws inside `file-cog`, which is not the standalone `cog`
 * glyph). Node tuples mirror lucide's `IconNode` shape `[tag, attrs]`.
 *
 * The file-cog gear geometry below is copied verbatim from
 * `@lucide/svelte`'s `file-cog` iconData (spokes + r=3 circle centered
 * at 7,18). `overlay_transform` keeps the gear at its native (7,18) —
 * left of canvas center, on the baseline, clear of every activity
 * stroke; the SVG mask knocks out the base wherever they meet.
 */
export interface ComposedIconDecl {
  /** Primary glyph — full-size base icon. */
  base: string;
  /** Secondary glyph — small badge anchored bottom-right (lucide name). */
  overlay?: string;
  /** Secondary glyph as raw lucide node tuples `[tag, attrs]` (24×24 space). */
  overlay_nodes?: Array<[string, Record<string, string | number>]>;
  /** SVG transform applied to `overlay_nodes` (translate + optional scale). */
  overlay_transform?: string;
}

/** The thin-spoked gear sub-glyph lucide draws inside `file-cog` —
 *  verbatim node data, centered at (7,18) in the 24×24 viewBox. */
const FILE_COG_GEAR: Array<[string, Record<string, string | number>]> = [
  ['path', { d: 'm3.305 19.53.923-.382' }],
  ['path', { d: 'm4.228 16.852-.924-.383' }],
  ['path', { d: 'm5.852 15.228-.383-.923' }],
  ['path', { d: 'm5.852 20.772-.383.924' }],
  ['path', { d: 'm8.148 15.228.383-.923' }],
  ['path', { d: 'm8.53 21.696-.382-.924' }],
  ['path', { d: 'm9.773 16.852.922-.383' }],
  ['path', { d: 'm9.773 19.148.922.383' }],
  ['circle', { cx: 7, cy: 18, r: 3 }],
];

export const COMPOSED_ICONS: Record<string, ComposedIconDecl> = {
  /** Activity line + the file-cog gear slightly left of center, baseline
   *  Y — "process context". */
  'activity-cog': {
    base: 'activity',
    overlay_nodes: FILE_COG_GEAR,
    overlay_transform: 'translate(0 0)',
  },
};
