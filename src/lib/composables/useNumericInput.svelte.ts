/**
 * useNumericInput — composable that encapsulates all numeric input state and
 * logic for the ONE numeric control (bigint/number/decimal kinds).
 *
 * Owns:
 *   - internal canonical DISPLAY value (dot decimal, no thousand separators —
 *     in UoM display units: for percent the raw is the percent-points number)
 *   - derived locale-formatted display value (locale decimal + thousand separators)
 *   - unsigned flag (prop `unsigned` OR type_config.validation.unsigned) —
 *     `-` is not an admissible char and negatives are rejected
 *   - effective min/max derivation (props > type_config rules > unsigned→0),
 *     expressed in DISPLAY units when a uom transform applies
 *   - inputmode attribute (numeric for bigint, decimal for number/decimal)
 *   - character filtering (strips invalid chars in real-time as user types)
 *   - step arithmetic — bigint → BigInt, decimal → @primebrick/decimal,
 *     number → Number; NEVER float math on bigint/decimal
 *   - out-of-bounds clamp on blur/step + oob issue for the hint
 *   - uom transforms: before_return (display → emitted canonical) and
 *     after_receive (emitted canonical → display) — percent is the built-in
 *     pair {×100, ÷100}; custom uoms bring their own hooks
 *   - native type conversion (string → bigint/number/Decimal)
 *   - leading-zero normalization on blur
 *   - cursor position management for masked display
 *
 * Dual-value architecture:
 *   - _rawValue: canonical DISPLAY string (uom-transformed side)
 *   - emitted canonical: PG-format string ("1234.56") — what the form/DB
 *     consumes. `toWire`/`"12.34d"` suffixes never leave this boundary.
 *
 * Follows the composable state exposure pattern from AGENTS.md:
 *   - $state consolidated into _state (underscore = internal)
 *   - $derived values exposed via individual getters
 *   - Mutations through mutator functions or controlled getter/setter pairs
 */
import type { DeepReadonly } from '../utils/index.js';
import {
	dec,
	add,
	mul,
	div,
	neg,
	cmp,
	signum,
	isDecimal,
	normalize as decNormalize,
	toPG,
	DecimalError,
	type Decimal,
	type DecimalInput,
} from '@primebrick/core';

/** Canonical string from a Decimal — PG form with trailing zeros stripped
 *  (`10.0` → `"10"`, `0.1000…` → `"0.1"`). Scale noise from mul/div must
 *  never reach the bound value or the display layer. */
const canon = (d: Decimal): string => toPG(decNormalize(d));

export type NumericKind = 'bigint' | 'number' | 'decimal';

/** Context handed to custom-uom transform hooks — the hook sees the
 *  resolved kind, the uom spec itself, and the component's prop snapshot
 *  so future manipulations can widen their horizon without new plumbing. */
export interface NumericUomCtx {
	kind: NumericKind;
	uom: NumericUomSpec;
	props: Record<string, unknown>;
}

/**
 * Resolved unit-of-measure spec — what the COMPONENT receives. The
 * contract-level declaration lives on `MetaColumn.uom`; hosts resolve it
 * (symbol, code, picker CTA) before passing this spec in.
 */
export interface NumericUomSpec {
	kind: 'percent' | 'currency' | 'custom';
	/** Resolved display symbol — `€`, `%`, `kg`… */
	symbol?: string;
	/** Current uom code — `EUR`, `kg`… (currency + non-static custom) */
	code?: string;
	/** Adornment side — default: currency prefix, percent/custom suffix. */
	position?: 'prefix' | 'suffix';
	/** Selector CTA — host opens the picker surface (sheet) on click. */
	on_pick?: () => void;
	/** display-canonical → emitted canonical (e.g. percent ÷100). */
	before_return?: (canonical: string, ctx: NumericUomCtx) => string;
	/** emitted canonical → display-canonical (e.g. percent ×100). */
	after_receive?: (canonical: string, ctx: NumericUomCtx) => string;
}

interface UseNumericInputOptions {
	/** Reactive getter for the numeric kind */
	kind: () => NumericKind;
	/** Reactive getter for type_config JSON string */
	type_config: () => string | null;
	/** Reactive getter for the external value (prop) */
	value: () => string | bigint | number | Decimal | undefined | null;
	/** Reactive getter for the BCP 47 language tag (e.g. 'it-IT', 'en-GB') */
	lang: () => string;
	/** Reactive getter for the resolved uom spec */
	uom: () => NumericUomSpec | undefined;
	/** Prop-level unsigned override — wins over type_config */
	unsigned: () => boolean | undefined;
	/** Prop-level bounds — win over type_config rules */
	min: () => string | number | bigint | undefined;
	max: () => string | number | bigint | undefined;
	/** Prop-level step (canonical string) — default '1' / '1.0' */
	step: () => string | undefined;
	/** Component props snapshot for uom transform ctx */
	props?: () => Record<string, unknown>;
}

/**
 * Narrow type_config reader — the composable only needs three fields:
 * `validation.unsigned`, `validation.rules.min/max.value`, `currency`. The
 * canonical zod schema is consumer-side config domain; this reads the
 * same stored shape without importing it.
 */
function parseTypeConfig(raw: string | null): {
	validation?: {
		unsigned?: boolean;
		rules?: { min?: { value: number }; max?: { value: number } };
	};
	currency?: string;
} | null {
	if (!raw) return null;
	try {
		// standards-exempt: ext-json — type_config is stored config JSON, not an ext-json wire payload
		const v = JSON.parse(raw);
		return v && typeof v === 'object' ? v : null;
	} catch {
		return null;
	}
}

/**
 * Normalize leading zeros in the integer part of a canonical numeric string.
 * - `000123` → `123` (strip leading zeros before nonzero digits)
 * - `000` → `0` (all zeros → single zero)
 * - `0.50` → `0.50` (preserve decimal part, integer part already minimal)
 * - `000.50` → `0.50` (strip leading zeros, keep one zero before decimal)
 * - `-000123` → `-123` (preserve sign)
 * - `` → `` (empty stays empty)
 * - `-` → `-` (lone minus stays)
 */
function normalizeNumericString(raw: string): string {
	if (raw === '' || raw === '-') return raw;
	const negative = raw.startsWith('-');
	const body = negative ? raw.slice(1) : raw;
	const [intPart, ...decParts] = body.split('.');
	// Strip leading zeros from integer part, keep at least one digit
	const normalizedInt = intPart.replace(/^0+(?=\d)/, '');
	const decPart = decParts.length > 0 ? '.' + decParts.join('.') : '';
	return (negative ? '-' : '') + normalizedInt + decPart;
}

/**
 * Filter a canonical numeric string (dot decimal, no separators).
 * Strips invalid characters to prevent `--`, `++`, `ee`, etc.
 * - Unsigned: only digits and one decimal point (for number/decimal)
 * - Signed: digits, one leading minus, one decimal point (for number/decimal)
 * - BigInt: no decimal point at all
 */
function filterCanonicalInput(raw: string, kind: NumericKind, isUnsigned: boolean): string {
	if (kind === 'bigint') {
		if (isUnsigned) {
			return raw.replace(/[^\d]/g, '');
		}
		const negative = raw.startsWith('-');
		const digits = raw.replace(/[^\d]/g, '');
		return digits === '' ? (negative ? '-' : '') : (negative ? '-' : '') + digits;
	}
	// number / decimal — allow one decimal point
	if (isUnsigned) {
		const cleaned = raw.replace(/[^\d.]/g, '');
		const parts = cleaned.split('.');
		return parts.length <= 1 ? parts[0] : parts[0] + '.' + parts.slice(1).join('');
	}
	const negative = raw.startsWith('-');
	const cleaned = raw.replace(/[^\d.]/g, '');
	const parts = cleaned.split('.');
	const body = parts.length <= 1 ? parts[0] : parts[0] + '.' + parts.slice(1).join('');
	if (body === '') return negative ? '-' : '';
	return (negative ? '-' : '') + body;
}

/**
 * Convert a canonical string to a locale-formatted display string.
 * Formats the integer part with locale thousand separators, then appends
 * the decimal part (if any) with the locale's decimal separator.
 *
 * This approach preserves:
 *   - A trailing decimal separator (e.g. `1234.` → `1.234,` in it-IT)
 *     so the user can continue typing fractional digits after pressing
 *     the decimal separator key.
 *   - Exact fractional digits including trailing zeros (e.g. `1234.00` → `1.234,00`)
 *     because `Intl.NumberFormat` with `minimumFractionDigits: 0` would strip them.
 *
 * @param canonical - canonical string (dot decimal, no thousand separators)
 * @param kind - numeric kind (bigint has no decimal)
 * @param lang - BCP 47 language tag
 */
function formatDisplay(canonical: string, kind: NumericKind, lang: string): string {
	if (canonical === '' || canonical === '-') return canonical;

	const negative = canonical.startsWith('-');
	const body = negative ? canonical.slice(1) : canonical;
	const dotIndex = body.indexOf('.');
	const hasDecimal = dotIndex !== -1;
	const intPart = hasDecimal ? body.slice(0, dotIndex) : body;
	const decPart = hasDecimal ? body.slice(dotIndex + 1) : '';

	// Detect locale decimal separator
	let decSep = '.';
	try {
		const parts = new Intl.NumberFormat(lang).formatToParts(1.1);
		decSep = parts.find((p) => p.type === 'decimal')?.value ?? '.';
	} catch { /* use default */ }

	try {
		// Format integer part with grouping
		let formattedInt: string;
		if (intPart === '') {
			formattedInt = '0';
		} else if (kind === 'bigint') {
			// For bigint, use BigInt for accurate large number formatting
			try {
				const n = BigInt(intPart);
				const num = Number(n);
				if (Number.isSafeInteger(num)) {
					formattedInt = new Intl.NumberFormat(lang, { useGrouping: true, maximumFractionDigits: 0 }).format(num);
				} else {
					formattedInt = formatWithGrouping(intPart, lang);
				}
			} catch {
				formattedInt = formatWithGrouping(intPart, lang);
			}
		} else {
			// decimal kind formats via Decimal → canonical string, never a
			// rounded Number (precision must survive the display layer).
			if (kind === 'decimal') {
				try {
					formattedInt = formatWithGrouping(intPart, lang);
				} catch {
					return canonical;
				}
			} else {
				const n = Number(intPart);
				if (isNaN(n)) return canonical;
				formattedInt = new Intl.NumberFormat(lang, { useGrouping: true, maximumFractionDigits: 0 }).format(n);
			}
		}

		// Build result: sign + formatted integer + optional decimal part
		let result = formattedInt;
		if (hasDecimal && kind !== 'bigint') {
			result += decSep + decPart;
		}

		return (negative ? '-' : '') + result;
	} catch {
		return canonical;
	}
}

/**
 * Manual grouping for very large bigint values that exceed Number precision.
 * Uses Intl.NumberFormat to detect the locale's group separator.
 */
function formatWithGrouping(digits: string, lang: string): string {
	let groupSep = ',';
	try {
		const parts = new Intl.NumberFormat(lang).formatToParts(1111111);
		groupSep = parts.find((p) => p.type === 'group')?.value ?? ',';
	} catch { /* use default */ }

	const negative = digits.startsWith('-');
	const body = negative ? digits.slice(1) : digits;
	// Group from right in chunks of 3
	const groups: string[] = [];
	for (let i = body.length; i > 0; i -= 3) {
		groups.unshift(body.slice(Math.max(0, i - 3), i));
	}
	return (negative ? '-' : '') + groups.join(groupSep);
}

/**
 * Parse a locale-formatted display string back to canonical (dot decimal, no separators).
 * @param display - locale-formatted string (e.g. "1.234,50" in it-IT)
 * @param decimalSep - the locale's decimal separator (e.g. "," for it-IT)
 * @param thousandSep - the locale's thousand separator (e.g. "." for it-IT)
 */
function parseDisplayToCanonical(
	display: string,
	decimalSep: string,
	thousandSep: string,
): string {
	let s = display;
	// Remove thousand separators
	if (thousandSep) {
		// Escape regex special chars
		const escaped = thousandSep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		s = s.replace(new RegExp(escaped, 'g'), '');
	}
	// Replace locale decimal separator with canonical dot
	if (decimalSep !== '.') {
		s = s.replace(decimalSep, '.');
	}
	return s;
}

/** Parse a bound into a Decimal — returns null for unparsable/undefined. */
function boundToDec(bound: string | number | bigint | undefined | null): Decimal | null {
	if (bound === undefined || bound === null || bound === '') return null;
	try {
		return dec(bound as DecimalInput);
	} catch {
		return null;
	}
}

export function useNumericInput(options: UseNumericInputOptions) {
	const { kind, type_config, value, lang, uom, unsigned, min, max, step, props } = options;

	// Consolidated internal state (underscore = internal)
	const _state = $state({
		_rawValue: String(value() ?? ''),
		/** Out-of-bounds issue raised by the last clamp — 'minimum'|'maximum'|null */
		_oobIssue: null as 'minimum' | 'maximum' | null,
		_oobBound: '' as string,
	});

	// ── UoM transform pipeline ───────────────────────────────────────────
	// percent is the built-in pair {after_receive: ×100, before_return: ÷100}
	// implemented with dec() math — exact, never floats.

	const uomCtx = (): NumericUomCtx => ({
		kind: kind(),
		uom: uom() as NumericUomSpec,
		props: props?.() ?? {},
	});

	const afterReceive = $derived.by<(canonical: string) => string>(() => {
		const spec = uom();
		if (!spec) return (c) => c;
		if (spec.kind === 'percent') {
			return (c) => {
				if (c === '' || c === '-') return c;
				try {
					return canon(mul(dec(c), 100));
				} catch {
					return c;
				}
			};
		}
		if (spec.after_receive) return (c) => spec.after_receive!(c, uomCtx());
		return (c) => c;
	});

	const beforeReturn = $derived.by<(canonical: string) => string>(() => {
		const spec = uom();
		if (!spec) return (c) => c;
		if (spec.kind === 'percent') {
			return (c) => {
				if (c === '' || c === '-') return c;
				try {
					return canon(div(dec(c), 100));
				} catch {
					return c;
				}
			};
		}
		if (spec.before_return) return (c) => spec.before_return!(c, uomCtx());
		return (c) => c;
	});

	// Derived values
	const isUnsigned = $derived.by<boolean>(() => {
		const prop = unsigned();
		if (prop !== undefined) return prop;
		const parsed = parseTypeConfig(type_config());
		return parsed?.validation?.unsigned === true;
	});

	/** Canonical (emitted-space) bounds: prop > type_config rule > unsigned→0 */
	const canonicalMin = $derived.by<Decimal | null>(() => {
		const prop = boundToDec(min());
		if (prop) return prop;
		const parsed = parseTypeConfig(type_config());
		const rules = parsed?.validation?.rules;
		if (rules?.min) return boundToDec(rules.min.value);
		if (isUnsigned) return dec(0);
		return null;
	});

	const canonicalMax = $derived.by<Decimal | null>(() => {
		const prop = boundToDec(max());
		if (prop) return prop;
		const parsed = parseTypeConfig(type_config());
		const rules = parsed?.validation?.rules;
		if (rules?.max) return boundToDec(rules.max.value);
		return null;
	});

	/** Display-space bounds — canonical bounds pushed through after_receive
	 *  (percent min 0.5 → the user sees "50"). The hint always speaks in the
	 *  units the user types. */
	const displayMin = $derived.by<Decimal | null>(() => {
		const b = canonicalMin;
		if (!b) return null;
		try {
			return dec(afterReceive(canon(b)));
		} catch {
			return b;
		}
	});

	const displayMax = $derived.by<Decimal | null>(() => {
		const b = canonicalMax;
		if (!b) return null;
		try {
			return dec(afterReceive(canon(b)));
		} catch {
			return b;
		}
	});

	const inputMode = $derived<'numeric' | 'decimal'>(kind() === 'bigint' ? 'numeric' : 'decimal');

	const currency = $derived.by<string>(() => {
		const parsed = parseTypeConfig(type_config());
		return parsed?.currency ?? 'EUR';
	});

	/** Resolved step — prop wins; default '1' (bigint) / '1.0' (decimal kinds).
	 *  MUST be ≠ 0 and, when both bounds exist, |step| ≤ (max − min); a
	 *  violating step is a host bug — stepBy no-ops on it. */
	const stepDec = $derived.by<Decimal | null>(() => {
		const raw = step() ?? (kind() === 'bigint' ? '1' : '1.0');
		let s: Decimal;
		try {
			s = dec(raw);
		} catch {
			return null;
		}
		if (signum(s) === 0) return null;
		if (canonicalMin && canonicalMax) {
			try {
				const span = add(canonicalMax, neg(canonicalMin));
				if (cmp(dec(s.toString().replace('-', '')), span) > 0) return null;
			} catch {
				return null;
			}
		}
		return s;
	});

	// Locale separators derived from lang using Intl.NumberFormat
	const decimalSeparator = $derived.by<string>(() => {
		try {
			const parts = new Intl.NumberFormat(lang()).formatToParts(1.1);
			return parts.find((p) => p.type === 'decimal')?.value ?? '.';
		} catch {
			return '.';
		}
	});

	const thousandSeparator = $derived.by<string>(() => {
		try {
			// Use a large number to ensure grouping is triggered in all locales
			const parts = new Intl.NumberFormat(lang()).formatToParts(1111111);
			return parts.find((p) => p.type === 'group')?.value ?? '';
		} catch {
			return '';
		}
	});

	// Display value — locale-formatted for the input element
	const displayValue = $derived<string>(formatDisplay(_state._rawValue, kind(), lang()));

	/**
	 * Sync rawValue from the external prop.
	 * Called by the component when the external value changes (e.g. form reset).
	 */
	function syncFromProp() {
		const externalValue = value();
		// Decimal instances normalize through toPG — the bound contract stays
		// a canonical string either way.
		const canonical = isDecimal(externalValue) ? canon(externalValue) : String(externalValue ?? '');
		// Push through after_receive: canonical → display units (percent ×100).
		const displayRaw = afterReceive(canonical);
		// Custom after_receive hooks own their arithmetic but not the canonical
		// format — strip scale noise (`5.0000…` → `5`) before it becomes the
		// user's display text. Non-numeric hook output passes through unchanged
		// and is left to the char filter below.
		let display = displayRaw;
		if (displayRaw !== '' && displayRaw !== '-') {
			try {
				display = canon(dec(displayRaw));
			} catch {
				/* keep raw */
			}
		}
		// Sanitize through the same filter used on input — a stale/garbage
		// string must never reach `displayValue`.
		_state._rawValue = filterCanonicalInput(display, kind(), isUnsigned);
	}

	/**
	 * oninput handler — parse display string to canonical, filter invalid chars.
	 * Call from the component's oninput event with the input element's current value.
	 * @param displayStr - the current value of the input element (locale-formatted)
	 */
	function filterInput(displayStr: string): void {
		const canonical = parseDisplayToCanonical(displayStr, decimalSeparator, thousandSeparator);
		_state._rawValue = filterCanonicalInput(canonical, kind(), isUnsigned);
		// Any new edit clears a previously raised out-of-bounds hint.
		_state._oobIssue = null;
	}

	/** Current display-side value as Decimal — null for empty/unparseable. */
	function currentDec(): Decimal | null {
		const raw = _state._rawValue;
		if (raw === '' || raw === '-') return null;
		try {
			return dec(raw);
		} catch {
			return null;
		}
	}

	/**
	 * Clamp the display-side value to [displayMin, displayMax] — sets the
	 * oob issue so the component can render "non sono ammessi valori
	 * inferiori/superiori a X". Returns true when a clamp occurred.
	 */
	function clamp(): boolean {
		const cur = currentDec();
		if (!cur) {
			_state._oobIssue = null;
			return false;
		}
		if (displayMin && cmp(cur, displayMin) < 0) {
			_state._rawValue = canon(displayMin);
			_state._oobIssue = 'minimum';
			_state._oobBound = canon(displayMin);
			return true;
		}
		if (displayMax && cmp(cur, displayMax) > 0) {
			_state._rawValue = canon(displayMax);
			_state._oobIssue = 'maximum';
			_state._oobBound = canon(displayMax);
			return true;
		}
		return false;
	}

	/**
	 * Increment/decrement by step — display-space arithmetic per kind:
	 * bigint → BigInt, decimal/number → Decimal (exact, never floats for
	 * decimal; number's float limit is inherent to its kind anyway, and
	 * dec() keeps the math uniform). Empty input starts from 0 (or the
	 * bound nearest 0 when 0 is out of range). Result always clamps to
	 * bounds. Returns true when the value changed.
	 */
	function stepBy(dir: 1 | -1): boolean {
		const s = stepDec;
		if (!s) return false;
		let cur = currentDec();
		if (!cur) {
			if (displayMin && cmp(dec(0), displayMin) < 0) cur = displayMin;
			else if (displayMax && cmp(dec(0), displayMax) > 0) cur = displayMax;
			else cur = dec(0);
		}
		let next = add(cur, dir === 1 ? s : neg(s));
		if (kind() === 'bigint') {
			// bigint has no fractional part — truncate toward zero
			next = dec(canon(next).split('.')[0] || '0');
		}
		if (displayMin && cmp(next, displayMin) < 0) next = displayMin;
		if (displayMax && cmp(next, displayMax) > 0) next = displayMax;
		const nextStr = canon(next);
		if (nextStr === _state._rawValue) return false;
		_state._rawValue = nextStr;
		return true;
	}

	/** True when a + step would not change the value (top bound or bad step). */
	const atMax = $derived.by<boolean>(() => {
		const s = stepDec;
		if (!s) return true;
		const cur = currentDec();
		if (!cur) return displayMax ? cmp(dec(0), displayMax) >= 0 : false;
		if (displayMax) return cmp(add(cur, s), displayMax) > 0;
		return false;
	});

	const atMin = $derived.by<boolean>(() => {
		const s = stepDec;
		if (!s) return true;
		const cur = currentDec();
		if (!cur) return displayMin ? cmp(dec(0), displayMin) <= 0 : false;
		if (displayMin) return cmp(add(cur, neg(s)), displayMin) < 0;
		return false;
	});

	/**
	 * Emit — the canonical (post before_return) string the bound value
	 * carries. Percent "10" → "0.1"; custom uoms run their hook.
	 */
	function emit(): string {
		const raw = _state._rawValue;
		if (raw === '' || raw === '-') return raw;
		try {
			return beforeReturn(raw);
		} catch (e) {
			if (e instanceof DecimalError) return raw;
			throw e;
		}
	}

	/**
	 * Convert rawValue to native JS type.
	 * - bigint → native bigint (if parseable)
	 * - decimal → Decimal instance
	 * - number → native number (if parseable)
	 * - fallback → string as-is
	 */
	function toNative(): string | bigint | number | Decimal {
		const currentKind = kind();
		const localStr = _state._rawValue;
		if (localStr === '' || localStr === '-') return localStr;
		if (currentKind === 'bigint') {
			try {
				return BigInt(localStr);
			} catch {
				return localStr;
			}
		}
		if (currentKind === 'decimal') {
			try {
				return dec(localStr);
			} catch {
				return localStr;
			}
		}
		const n = Number(localStr);
		if (!isNaN(n)) return n;
		return localStr;
	}

	/**
	 * Normalize leading zeros in the integer part of rawValue.
	 * Called on blur before writing to the bound form value.
	 * Mutates _state._rawValue in place.
	 */
	function normalize(): void {
		_state._rawValue = normalizeNumericString(_state._rawValue);
	}

	/**
	 * Compute the cursor position after reformatting.
	 * Counts digits (and optional sign/decimal) before the old cursor position,
	 * then finds the corresponding position in the new display string.
	 *
	 * @param oldCursorPos - cursor position in the old display string
	 * @param oldDisplay - the old display string (before input)
	 * @param newDisplay - the new display string (after reformatting)
	 * @returns the new cursor position
	 */
	function computeCursorPosition(
		oldCursorPos: number,
		oldDisplay: string,
		newDisplay: string,
	): number {
		// Count meaningful characters (digits + sign + decimal sep) before cursor in old display
		let meaningfulBefore = 0;
		for (let i = 0; i < oldCursorPos && i < oldDisplay.length; i++) {
			const ch = oldDisplay[i];
			if (ch >= '0' && ch <= '9') meaningfulBefore++;
			else if (ch === '-' || ch === decimalSeparator) meaningfulBefore++;
		}

		// Find position in new display after that many meaningful characters
		let meaningfulSeen = 0;
		for (let i = 0; i < newDisplay.length; i++) {
			const ch = newDisplay[i];
			if (ch >= '0' && ch <= '9') meaningfulSeen++;
			else if (ch === '-' || ch === decimalSeparator) meaningfulSeen++;
			if (meaningfulSeen >= meaningfulBefore) {
				// Position cursor AFTER the current meaningful char
				return i + 1;
			}
		}
		return newDisplay.length;
	}

	return {
		// Bindable rawValue — getter/setter pair for direct access (used on blur)
		get rawValue(): string {
			return _state._rawValue;
		},
		set rawValue(v: string) {
			_state._rawValue = v;
		},
		// Display value — locale-formatted, read-only (derived)
		get displayValue(): string {
			return displayValue;
		},
		// Internal state exposure (DeepReadonly — no external mutations)
		get state(): DeepReadonly<typeof _state> {
			return _state as DeepReadonly<typeof _state>;
		},
		// $derived values via individual getters
		get isUnsigned(): boolean {
			return isUnsigned;
		},
		get effectiveMin(): string | null {
			return canonicalMin ? canon(canonicalMin) : null;
		},
		get effectiveMax(): string | null {
			return canonicalMax ? canon(canonicalMax) : null;
		},
		/** Bounds in DISPLAY units (uom-transformed) — the aria-valuemin/max
		 *  and the oob hint must speak the units the user types. */
		get displayMin(): string | null {
			return displayMin ? canon(displayMin) : null;
		},
		get displayMax(): string | null {
			return displayMax ? canon(displayMax) : null;
		},
		get inputMode(): 'numeric' | 'decimal' {
			return inputMode;
		},
		get currency(): string {
			return currency;
		},
		get decimalSeparator(): string {
			return decimalSeparator;
		},
		get thousandSeparator(): string {
			return thousandSeparator;
		},
		get stepDec(): Decimal | null {
			return stepDec;
		},
		get atMax(): boolean {
			return atMax;
		},
		get atMin(): boolean {
			return atMin;
		},
		get oobIssue(): 'minimum' | 'maximum' | null {
			return _state._oobIssue;
		},
		get oobBound(): string {
			return _state._oobBound;
		},
		// Mutators
		syncFromProp,
		filterInput,
		clamp,
		stepBy,
		emit,
		toNative,
		normalize,
		computeCursorPosition,
	};
}
