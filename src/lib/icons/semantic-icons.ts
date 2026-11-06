import { SEMANTIC_ICON_COLORS, type ActionColor } from "@primebrick/core";
import ExecStart from "./ExecStart.svelte";
import ExecStop from "./ExecStop.svelte";
import type { Component } from "svelte";

/**
 * Semantic icon registry — domain glyphs whose COLOR IS THE SEMANTIC.
 * Each entry binds an icon name to a self-colored component (gradient
 * baked into the SVG); the label color comes from `SEMANTIC_ICON_COLORS`
 * in `@primebrick/core` — the ONE contract table. A meta declaring an
 * `exec-*` icon with a divergent `color` is rejected by
 * `validateActionChrome` at construction time: icon and label can never
 * drift apart even by accident.
 *
 * Lucide/composed icons keep `currentColor` behavior; only names in THIS
 * registry are self-colored.
 */
export const SEMANTIC_ICONS: Record<
  string,
  { component: Component<{ size?: number; class?: string; style?: string }>; color: ActionColor }
> = {
  "exec-start": { component: ExecStart, color: SEMANTIC_ICON_COLORS["exec-start"] },
  "exec-stop": { component: ExecStop, color: SEMANTIC_ICON_COLORS["exec-stop"] },
};

/** The `ActionColor` a semantic icon binds to — `undefined` for ordinary
 *  lucide/composed icons (their color comes from the meta's `color`). */
export function semanticIconColor(icon: string | undefined): ActionColor | undefined {
  return icon ? SEMANTIC_ICONS[icon]?.color : undefined;
}

/**
 * Maps an `ActionColor` to the `Button` variant carrying the same semantic —
 * the ONE mapping for button surfaces (bulk toolbar, dialogs). `neutral` and
 * `primary` resolve to `default` (the primary gradient); the four named
 * severities map 1:1 to their variants. Replaces the old
 * `text_color?.includes('red')` sniff — color is a contract, not a string.
 */
export function actionColorButtonVariant(
  color: ActionColor | undefined | null,
): "default" | "destructive" | "warning" | "success" | "info" {
  switch (color) {
    case "destructive":
    case "warning":
    case "success":
    case "info":
      return color;
    default:
      return "default";
  }
}
