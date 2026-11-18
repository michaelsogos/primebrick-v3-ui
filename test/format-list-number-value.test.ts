import { describe, expect, it } from 'vitest';
import { formatListCellValue, formatListNumberValue } from '../src/lib/utils/format-date.js';

/**
 * The universal numeric cell contract: `type:"number"` columns ALWAYS
 * render locale-formatted (group + decimal separators — `useGrouping:
 * "always"`, so 4-digit groups hold even where ICU's `auto` mode would
 * skip them) and right-aligned (alignment lives in the FE cell-styling
 * util). `uom` adds unit semantics via Intl-native styles: percent
 * (canonical fraction), currency (sibling ISO field), custom (fixed
 * sanctioned `unit`, per-row `field` code, or `symbol` suffix).
 */

const NUM = { type: 'number' } as const;

describe('formatListNumberValue — plain numbers', () => {
  it('applies group + decimal separators per locale', () => {
    expect(formatListNumberValue({}, 1234567.891, 'en-GB')).toBe('1,234,567.891');
    expect(formatListNumberValue({}, 1234567.891, 'it-IT')).toBe('1.234.567,891');
    expect(formatListNumberValue({}, -42.5, 'it-IT')).toBe('-42,5');
  });

  it('keeps full fractional precision (no silent 3-decimal rounding)', () => {
    expect(formatListNumberValue({}, 0.123456, 'en-GB')).toBe('0.123456');
  });

  it('formats bigint and numeric-string wire values', () => {
    expect(formatListNumberValue({}, 123456789012345n, 'en-GB')).toBe('123,456,789,012,345');
    expect(formatListNumberValue({}, '12345.5', 'it-IT')).toBe('12.345,5');
  });

  it('groups 4-digit numbers everywhere — useGrouping:"always" pins the contract', () => {
    // The regression this contract kills: Intl 'auto' mode lets ICU skip
    // the group separator on 4-digit values in it-IT — same cell, two
    // renders. 'always' makes grouping locale-independent in shape.
    expect(formatListNumberValue({}, 1234.5, 'it-IT')).toBe('1.234,5');
    expect(formatListNumberValue({}, 1234.5, 'en-GB')).toBe('1,234.5');
    expect(formatListNumberValue({}, 1234.5, 'de-DE')).toBe('1.234,5');
    expect(formatListNumberValue({}, 1234.5, 'fr-FR')).toBe('1 234,5');
  });

  it('renders non-numeric garbage raw — a data bug stays visible', () => {
    expect(formatListNumberValue({}, 'abc', 'en-GB')).toBe('abc');
  });

  it('derives the fraction budget from pg_type — bigint integers never show decimals', () => {
    const intCol = { pg_type: 'int8' } as const;
    expect(formatListNumberValue(intCol, 1496.7, 'it-IT')).toBe('1.497');
    expect(formatListNumberValue(intCol, 1496, 'en-GB')).toBe('1,496');
    // number/decimal kinds keep full fractional precision.
    const decCol = { pg_type: 'numeric(10,4)' } as const;
    expect(formatListNumberValue(decCol, 1.2345, 'en-GB')).toBe('1.2345');
    const numCol = { pg_type: 'float8' } as const;
    expect(formatListNumberValue(numCol, 0.123456, 'en-GB')).toBe('0.123456');
  });
});

describe('formatListNumberValue — uom', () => {
  it('percent renders the canonical fraction as percent-points', () => {
    const col = { uom: { kind: 'percent' } } as const;
    expect(formatListNumberValue(col, 0.15, 'it-IT')).toBe('15%');
    expect(formatListNumberValue(col, 0.1234, 'it-IT')).toBe('12,34%');
    expect(formatListNumberValue(col, 1, 'en-GB')).toBe('100%');
  });

  it('currency resolves the ISO code from the row sibling field', () => {
    const col = { uom: { kind: 'currency', field: 'currency_code' } } as const;
    const row = { currency_code: 'EUR' };
    expect(formatListNumberValue(col, 1234.5, 'en-GB', row)).toBe('€1,234.50');
    expect(formatListNumberValue(col, 1234.5, 'it-IT', row)).toBe('1.234,50\u00a0€');
  });

  it('currency with a weird/absent code never throws — honest fallbacks', () => {
    const col = { uom: { kind: 'currency', field: 'currency_code' } } as const;
    // Well-formed but unassigned ISO → Intl renders the code as symbol.
    expect(formatListNumberValue(col, 100, 'en-GB', { currency_code: 'ZZZ' })).toBe('ZZZ\u00a0100.00');
    // Malformed code → Intl throws → decimal + raw code text.
    expect(formatListNumberValue(col, 100, 'en-GB', { currency_code: 'E' })).toBe('100 E');
    expect(formatListNumberValue(col, 100, 'en-GB', {})).toBe('100');
    expect(formatListNumberValue(col, 100, 'en-GB')).toBe('100');
  });

  it('custom uses symbol when declared, else the row code suffix', () => {
    const sym = { uom: { kind: 'custom', field: 'uom_code', source: 'currencies', symbol: 'ms' } } as const;
    expect(formatListNumberValue(sym, 250, 'it-IT', { uom_code: 'ignored' })).toBe('250 ms');
    const fld = { uom: { kind: 'custom', field: 'uom_code', source: 'currencies' } } as const;
    // "kg" is not an Intl-sanctioned identifier → plain suffix fallback.
    expect(formatListNumberValue(fld, 1234.5, 'it-IT', { uom_code: 'kg' })).toBe('1.234,5 kg');
  });

  it('custom unit renders via Intl style:"unit" — the fixed sanctioned unit', () => {
    const col = { uom: { kind: 'custom', unit: 'millisecond' } } as const;
    expect(formatListNumberValue(col, 24, 'it-IT')).toBe('24 ms');
    expect(formatListNumberValue(col, 24, 'en-GB')).toBe('24 ms');
    expect(formatListNumberValue(col, 1234.5, 'it-IT')).toBe('1.234,5 ms');
    const kg = { uom: { kind: 'custom', unit: 'kilogram' } } as const;
    expect(formatListNumberValue(kg, 1234.5, 'it-IT')).toBe('1.234,5 kg');
  });

  it('custom field resolves a sanctioned per-row code via Intl style:"unit"', () => {
    const col = { uom: { kind: 'custom', field: 'uom_code', source: 'currencies' } } as const;
    // "kilogram" IS sanctioned → Intl unit inflection, not a raw suffix.
    expect(formatListNumberValue(col, 2.5, 'it-IT', { uom_code: 'kilogram' })).toBe('2,5 kg');
  });

  it('custom symbol-only (no sibling, no unit) is a fixed arbitrary suffix', () => {
    const col = { uom: { kind: 'custom', symbol: 'pz' } } as const;
    expect(formatListNumberValue(col, 7, 'it-IT')).toBe('7 pz');
  });
});

describe('formatListCellValue — number kind dispatch', () => {
  it('routes type:"number" through the numeric formatter', () => {
    expect(formatListCellValue(NUM, 1234567.891, 'it-IT')).toBe('1.234.567,891');
    expect(formatListCellValue(NUM, 0.5, 'en-GB', { c: 'USD' })).toBe('0.5');
  });

  it('passes the row through for uom sibling resolution', () => {
    const col = { type: 'number', uom: { kind: 'currency', field: 'c' } } as const;
    // en-GB renders USD with the "US$" disambiguation prefix.
    expect(formatListCellValue(col, 9.99, 'en-GB', { c: 'USD' })).toBe('US$9.99');
  });

  it('leaves null/undefined empty', () => {
    expect(formatListCellValue(NUM, null, 'it-IT')).toBe('');
    expect(formatListCellValue(NUM, undefined, 'it-IT')).toBe('');
  });
});
