import { describe, expect, it } from 'vitest';
import { formatListCellValue, formatListNumberValue } from '../src/lib/utils/format-date.js';

/**
 * The universal numeric cell contract: `type:"number"` columns ALWAYS
 * render locale-formatted (group + decimal separators) and right-aligned
 * (alignment lives in the FE cell-styling util). `uom` adds unit semantics:
 * percent (canonical fraction), currency (sibling ISO field), custom
 * (sibling code or symbol).
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
    // it-IT groups only ≥10 000 (CLDR minimumGroupingDigits=2).
    expect(formatListNumberValue({}, '1234.5', 'it-IT')).toBe('1234,5');
    expect(formatListNumberValue({}, '12345.5', 'it-IT')).toBe('12.345,5');
  });

  it('renders non-numeric garbage raw — a data bug stays visible', () => {
    expect(formatListNumberValue({}, 'abc', 'en-GB')).toBe('abc');
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
    expect(formatListNumberValue(col, 1234.5, 'it-IT', row)).toBe('1234,50\u00a0€');
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
    expect(formatListNumberValue(fld, 1234.5, 'it-IT', { uom_code: 'kg' })).toBe('1234,5 kg');
    expect(formatListNumberValue(fld, 12345.5, 'it-IT', { uom_code: 'kg' })).toBe('12.345,5 kg');
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
