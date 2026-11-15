/**
 * Icon-name qualifiers — render-mode flags carried INSIDE the icon name
 * so meta-driven declarations (`cta.icon`, nav `icon`, column `icon`)
 * can request them without growing the meta contract. A qualifier rides
 * a `:`-suffixed tail — `pause:filled` asks for the `pause` glyph
 * rendered filled (`fill="currentColor"`) — and is stripped before
 * every lookup, so registries and the lucide glob always see the bare
 * icon name.
 *
 * `:filled` only makes sense on closed-shape glyphs (pause, play,
 * square, circle-dot…): filling an open path (a check mark, a folder
 * outline) paints nonsense — lucide ships no filled variants for that
 * reason. Declaring the qualifier is therefore a deliberate per-icon
 * design choice, never a global style toggle.
 */
export const FILLED_SUFFIX = ":filled" as const;

export interface ParsedIconName {
  /** Bare icon name — the key for every registry/glob lookup. */
  name: string;
  /** Whether a filled render was requested (suffix or explicit prop). */
  filled: boolean;
}

/** Split a declared icon name into its lookup key + render flags. */
export function parseIconName(name: string, filled = false): ParsedIconName {
  const suffixed = name.endsWith(FILLED_SUFFIX);
  return {
    name: suffixed ? name.slice(0, -FILLED_SUFFIX.length) : name,
    filled: filled || suffixed,
  };
}
