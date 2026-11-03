import tailwindColors from 'tailwindcss/colors';
import { contrastTextCss, oklchCssToHex } from './contrast.js';

export type TailwindColorToken = `${string}-${number}`;

export type TailwindSwatch = {
	/** e.g. "emerald-500" */
	token: TailwindColorToken;
	/** CSS color value (oklch string from tailwindcss/colors) */
	css: string;
	/** Approximate sRGB hex ("#RRGGBB") for labels/readouts. */
	hex: string;
	family: string;
	shade: number;
};

const TAILWIND_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

/** Full Tailwind palette flattened: every family × shade, ordered family-then-shade.
 *  Built once at module load; used by the color-picker "system" grid and the
 *  searchable token dropdown. */
export const tailwindSwatches: TailwindSwatch[] = (() => {
	const out: TailwindSwatch[] = [];
	for (const [family, shades] of Object.entries(
		tailwindColors as Record<string, unknown>
	)) {
		if (!shades || typeof shades !== 'object' || Array.isArray(shades)) continue;
		const record = shades as Record<string, string>;
		for (const shade of TAILWIND_SHADES) {
			const css = record[String(shade)];
			if (typeof css === 'string') {
				out.push({ token: `${family}-${shade}`, css, hex: oklchCssToHex(css), family, shade });
			}
		}
	}
	return out;
})();

/** Unique family names — declaration order reversed: vivid chromatic
 *  families first (pink, rose, red, …), the neutral/gray ramp last. */
export const tailwindFamilies: string[] = [
	...new Set(tailwindSwatches.map((s) => s.family))
].reverse();

function clampShade(v: number) {
  const allowed = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
  let best: number = allowed[0];
  let bestDist = Math.abs(v - best);
  for (const s of allowed) {
    const d = Math.abs(v - s);
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best as (typeof allowed)[number];
}

/** Semantic theme tokens usable wherever a badge/icon color token is
 *  accepted. They resolve through the shadcn `--color-*` aliases so the
 *  rendered color follows the active theme (light/dark) instead of a
 *  frozen swatch — `primary` is the canonical "accent of the app". */
const SEMANTIC_COLOR_TOKENS = new Set(['primary', 'secondary', 'accent', 'destructive', 'muted', 'info']);

function semanticColorCss(token: string): string | null {
	return SEMANTIC_COLOR_TOKENS.has(token) ? `var(--color-${token})` : null;
}

/** Resolve a color token (`"amber-500"`, hex, `rgb()/oklch()` css) to a raw
 *  CSS color string — same vocabulary as {@link badgeClassesFromToken},
 *  minus the badge box model. For icon/text `style="color: …"` use where a
 *  Tailwind class can't be generated from option data. */
export function colorCssFromToken(token: TailwindColorToken | string | null | undefined): string | null {
	if (token == null || token === '') return null;
	const semantic = semanticColorCss(token);
	if (semantic) return semantic;
	const m = token.match(/^([a-z]+)-(\d{2,3})$/);
	if (m) {
		const family = (tailwindColors as Record<string, unknown>)[m[1]];
		const shade = clampShade(Number(m[2]));
		return family && typeof family === 'object'
			? ((family as Record<number, string>)[shade] ?? (family as Record<number, string>)[300])
			: null;
	}
	// Bare family name → canonical mid-shade 500 (same convention as badges).
	const bare = token.match(/^([a-z]+)$/)?.[1];
	if (bare && (tailwindColors as Record<string, unknown>)[bare]) {
		return ((tailwindColors as Record<string, Record<number, string>>)[bare])[500] ?? null;
	}
	if (token.startsWith('#') || /^[a-z]+\s*\(/.test(token)) return token;
	return null;
}

export function badgeClassesFromToken(token: TailwindColorToken | string | null | undefined) {
  // Semantic theme tokens: theme-aware via the `--color-*` aliases — the
  // foreground var guarantees readable text in BOTH light and dark mode
  // (unlike a frozen shade with hardcoded white text).
  const semantic = token ? semanticColorCss(token) : null;
  if (semantic) {
    const fg = `var(--color-${token}-foreground)`;
    return {
      bgColor: semantic,
      borderColor: semantic,
      textColor: fg,
      darkBgColor: semantic,
      darkBorderColor: semantic,
      darkTextColor: fg
    };
  }

  // token example: "zinc-300"; bare family names ("blue") resolve to
  // shade 500 — the declared intent of a family color is its canonical
  // mid-shade, not the zinc fallback (which silently grayed every badge
  // authored with a family name).
  const m = token?.match(/^([a-z]+)-(\d{2,3})$/);
  const bareFamily = token?.match(/^([a-z]+)$/)?.[1];
  let baseColor: string;
  if (m) {
    // Full Tailwind palette (all families × shades 50–950), imported from
    // tailwindcss/colors — no hand-maintained hex map. Shade-aware:
    // `emerald-300` resolves to that exact shade, not the family default.
    const family = (tailwindColors as Record<string, unknown>)[m[1]];
    const shade = clampShade(Number(m[2]));
    baseColor =
      family && typeof family === 'object'
        ? ((family as Record<number, string>)[shade] ?? (family as Record<number, string>)[300])
        : (tailwindColors as Record<string, Record<number, string>>).zinc[300];
  } else if (bareFamily && (tailwindColors as Record<string, unknown>)[bareFamily]) {
    baseColor =
      ((tailwindColors as Record<string, Record<number, string>>)[bareFamily])[500]
      ?? (tailwindColors as Record<string, Record<number, string>>).zinc[300];
  } else if (token && (token.startsWith('#') || /^[a-z]+\s*\(/.test(token))) {
    // Free-form CSS color from the color picker (hex / rgb / hsl / oklch).
    baseColor = token;
  } else {
    baseColor = (tailwindColors as Record<string, Record<number, string>>).zinc[300];
  }

  // Generate solid background, text, and border colors (no opacity for better
  // visibility on colored backgrounds). Text is luminance-driven: dark ink on
  // light shades (emerald-300, zinc-300, …), white on dark — never hardcoded.
  const bgColor = baseColor;
  const borderColor = baseColor;
  const textColor = contrastTextCss(baseColor);
  const darkBgColor = baseColor;
  const darkBorderColor = baseColor;
  const darkTextColor = textColor;

  return {
    bgColor,
    borderColor,
    textColor,
    darkBgColor,
    darkBorderColor,
    darkTextColor
  };
}



