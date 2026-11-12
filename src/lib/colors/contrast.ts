/** Generic CSS-color contrast math — the canonical luminance / text-choice
 *  utilities shared by badges (`badgeClassesFromToken`), avatars, and any
 *  colored-surface text. WCAG relative luminance; the codebase threshold is
 *  0.5 (same convention the avatar palette established). */

/** oklch("L% C H") → "#RRGGBB" (sRGB). Used for swatch readouts and to
 *  normalize oklch strings before luminance math. */
export function oklchCssToHex(css: string): string {
	const m = css.match(/oklch\(([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/);
	if (!m) return css;
	const L = parseFloat(m[1]) / 100;
	const C = parseFloat(m[2]);
	const hRad = (parseFloat(m[3]) * Math.PI) / 180;
	const a = C * Math.cos(hRad);
	const b = C * Math.sin(hRad);
	const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
	const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
	const s_ = L - 0.0894841775 * a - 1.291485548 * b;
	const l = l_ * l_ * l_;
	const mm = m_ * m_ * m_;
	const ss = s_ * s_ * s_;
	const toSrgb = (x: number) =>
		x >= 0.0031308 ? 1.055 * Math.pow(x, 1 / 2.4) - 0.055 : 12.92 * x;
	const ch = (x: number) =>
		Math.min(Math.max(0, Math.round(toSrgb(x) * 255)), 255)
			.toString(16)
			.padStart(2, '0')
			.toUpperCase();
	return `#${ch(+4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * ss)}${ch(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * ss)}${ch(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * ss)}`;
}

export function hexToRgb(hex: string): [number, number, number] | null {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
	return result
		? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
		: null;
}

/** "rgb(16, 185, 129)" / "rgba(…)" → "#RRGGBB" (alpha ignored). */
export function rgbCssToHex(css: string): string | null {
	const m = css.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
	if (!m) return null;
	const ch = (v: string) =>
		Math.min(255, Math.max(0, parseInt(v, 10))).toString(16).padStart(2, '0');
	return `#${ch(m[1])}${ch(m[2])}${ch(m[3])}`.toUpperCase();
}

/** Convert HSL channel values to hex — hue wraps, sat/light clamp. */
export function hslToHex(h: number, s: number, l: number): string {
	const hue = ((h % 360) + 360) % 360;
	const sat = Math.max(0, Math.min(100, s)) / 100;
	const light = Math.max(0, Math.min(100, l)) / 100;
	const c = (1 - Math.abs(2 * light - 1)) * sat;
	const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
	const m = light - c / 2;
	let r: number, g: number, b: number;
	if (hue < 60) { r = c; g = x; b = 0; }
	else if (hue < 120) { r = x; g = c; b = 0; }
	else if (hue < 180) { r = 0; g = c; b = x; }
	else if (hue < 240) { r = 0; g = x; b = c; }
	else if (hue < 300) { r = x; g = 0; b = c; }
	else { r = c; g = 0; b = x; }
	const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** "hsl(210, 40%, 50%)" / "hsla(…)" → "#RRGGBB". Accepts space/comma syntax. */
export function hslCssToHex(css: string): string | null {
	const m = css.match(/hsla?\(\s*(-?[\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%/);
	if (!m) return null;
	return hslToHex(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
}

/** WCAG relative luminance of a hex color — 0 (black) … 1 (white). */
export function hexLuminance(hex: string): number | null {
	const rgb = hexToRgb(hex);
	if (!rgb) return null;
	const [r, g, b] = rgb.map((channel) => {
		const c = channel / 255;
		return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relative luminance of any CSS color string we can normalize —
 *  `#hex`, `rgb()/rgba()`, `hsl()/hsla()`, `oklch()`. Returns null for
 *  unparseable input (e.g. runtime `var(--token)`), so callers keep their
 *  previous default. */
export function cssToLuminance(css: string): number | null {
	const t = css.trim().toLowerCase();
	const hex = t.startsWith('#')
		? t
		: t.startsWith('oklch')
			? oklchCssToHex(css)
			: t.startsWith('rgb')
				? rgbCssToHex(css)
				: t.startsWith('hsl')
					? hslCssToHex(css)
					: null;
	return hex ? hexLuminance(hex) : null;
}

/** Text color for a colored surface: dark ink on light backgrounds, white
 *  on dark. Unparseable input → `fallback` (defaults to white — the
 *  pre-contrast behavior). Dark ink = zinc-900, matching the neutral ramp
 *  already used by muted chrome. */
export function contrastTextCss(
	css: string,
	{ dark = '#18181b', light = '#ffffff', fallback = '#ffffff' }: { dark?: string; light?: string; fallback?: string } = {}
): string {
	const l = cssToLuminance(css);
	if (l == null) return fallback;
	return l > 0.5 ? dark : light;
}
