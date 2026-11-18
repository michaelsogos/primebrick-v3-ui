import { extJsonStringify, type MetaColumn } from '@primebrick/core';


const dateOnlyFmt = new Map<string, Intl.DateTimeFormat>();
const dateTimeFmt = new Map<string, Intl.DateTimeFormat>();
/** Key: `${localeTag}@@${timeZone}` */
const dateTimeTzFmt = new Map<string, Intl.DateTimeFormat>();
/** Key: `${localeTag}@@${extJsonStringify(init)}` */
const numberFmt = new Map<string, Intl.NumberFormat>();

/** `UiLang` is already a BCP 47 tag — pass through to `Intl` as-is. */
export function uiLocaleTag(lang: string): string {
  return lang;
}

function getCached(
  cache: Map<string, Intl.DateTimeFormat>,
  tag: string,
  init: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  const key = `${tag}:${extJsonStringify(init)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(tag, init);
    cache.set(key, f);
  }
  return f;
}

function getCachedNumber(tag: string, init: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${tag}:${extJsonStringify(init)}`;
  let f = numberFmt.get(key);
  if (!f) {
    f = new Intl.NumberFormat(tag, init);
    numberFmt.set(key, f);
  }
  return f;
}

/**
 * Calendar date: two-digit day, short month, full year (e.g. `01 Jan 2026` in English).
 * Locale follows {@link UiLang}.
 */
export function formatUiDate(input: Date | string | number, lang: string): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const tag = uiLocaleTag(lang);
  const fmt = getCached(dateOnlyFmt, tag, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  return fmt.format(d);
}

/**
 * Calendar date + time (entity `datetime` columns, error drawer timestamps, etc.).
 * Uses one BCP 47 tag per shell language; does **not** set `hour12` — `Intl` applies each
 * locale’s default hour cycle (e.g. 12h vs 24h) from the standard algorithm.
 */
export function formatUiDateTime(input: Date | string | number, lang: string): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const tag = uiLocaleTag(lang);
  const fmt = getCached(dateTimeFmt, tag, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  });
  return fmt.format(d);
}

/**
 * Same calendar/hour presentation as {@link formatUiDateTime}, but in a specific IANA zone
 * (DST rules from the environment). Falls back to {@link formatUiDateTime} if `timeZone` is invalid.
 */
export function formatUiDateTimeInTimeZone(
  input: Date | string | number,
  lang: string,
  timeZone: string
): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const tag = uiLocaleTag(lang);
  const mapKey = `${tag}@@${timeZone}`;
  let fmt = dateTimeTzFmt.get(mapKey);
  if (!fmt) {
    try {
      fmt = new Intl.DateTimeFormat(tag, {
        timeZone,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit'
      });
      dateTimeTzFmt.set(mapKey, fmt);
    } catch {
      return formatUiDateTime(input, lang);
    }
  }
  try {
    return fmt.format(d);
  } catch {
    return formatUiDateTime(input, lang);
  }
}

/**
 * Scalar-safe display coercion for decoded wire values.
 *
 * `extJsonParse` (json-bigint strict) emits **null-prototype** objects —
 * `String(obj)` throws `Cannot convert object to primitive value` on them.
 * ANY non-scalar reaching the UI MUST go through this helper:
 * objects/arrays render as JSON, scalars as `String`.
 */
export function toDisplayString(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'object') return extJsonStringify(raw);
  return String(raw);
}

/**
 * Coerce a numeric wire value to `number | bigint` — `numeric`/`decimal`
 * columns legitimately cross the wire as strings (pg preserves precision);
 * a string that is not plain numeric is a data bug and stays untouched so
 * it remains visible instead of silently formatting as NaN.
 */
function toNumberish(raw: unknown): number | bigint | undefined {
  if (typeof raw === 'number' || typeof raw === 'bigint') return raw;
  if (typeof raw === 'string' && /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(raw.trim())) {
    return Number(raw);
  }
  return undefined;
}

/** Locale decimal — group separators always on, full fractional precision preserved. */
function formatDecimal(n: number | bigint, tag: string): string {
  return getCachedNumber(tag, { maximumFractionDigits: 20 }).format(n);
}

/**
 * `type:"number"` cell — ALWAYS locale-formatted (group + decimal separators)
 * and the caller right-aligns it. `column.uom` adds the unit semantics:
 * - `percent` — the canonical value is a FRACTION; Intl `style:"percent"`
 *   renders it as percent-points natively (0.1234 → "12,34%").
 * - `currency` — ISO 4217 code lives in the `uom.field` sibling of `row`;
 *   an absent/invalid code degrades to decimal + code text (never throws).
 * - `custom` — `symbol` wins, else the row's `uom.field` code as suffix.
 */
export function formatListNumberValue(
  column: Pick<MetaColumn, 'uom'>,
  raw: unknown,
  lang: string,
  row?: Record<string, unknown>
): string {
  const n = toNumberish(raw);
  if (n === undefined) return toDisplayString(raw);
  const tag = uiLocaleTag(lang);
  const uom = column.uom;
  if (uom?.kind === 'percent') {
    return getCachedNumber(tag, { style: 'percent', maximumFractionDigits: 20 }).format(n);
  }
  if (uom?.kind === 'currency') {
    const code = toDisplayString(row?.[uom.field]).trim();
    if (code) {
      try {
        return getCachedNumber(tag, { style: 'currency', currency: code }).format(n);
      } catch {
        // Not an ISO 4217 code — decimal + code text is the honest display.
        return `${formatDecimal(n, tag)} ${code}`;
      }
    }
  }
  const base = formatDecimal(n, tag);
  if (uom?.kind === 'custom') {
    const unit = uom.symbol ?? toDisplayString(row?.[uom.field]).trim();
    if (unit) return `${base} ${unit}`;
  }
  return base;
}

/** Default table cell: `date` → locale date only; `datetime` → {@link formatUiDateTime};
 *  `number` → {@link formatListNumberValue}; else {@link toDisplayString}. `row`
 *  is needed only when `column.uom` resolves its code from a sibling field. */
export function formatListCellValue(
  column: Pick<MetaColumn, 'type' | 'uom'>,
  raw: unknown,
  lang: string,
  row?: Record<string, unknown>
): string {
  if (raw === null || raw === undefined) return '';
  const kind = column.type ?? 'text';
  if (kind === 'date') {
    if (typeof raw === 'string' || typeof raw === 'number' || raw instanceof Date) {
      return formatUiDate(raw, lang);
    }
  }
  if (kind === 'datetime') {
    if (typeof raw === 'string' || typeof raw === 'number' || raw instanceof Date) {
      return formatUiDateTime(raw, lang);
    }
  }
  if (kind === 'number') {
    return formatListNumberValue(column, raw, lang, row);
  }
  return toDisplayString(raw);
}
