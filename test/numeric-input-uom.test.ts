import { describe, expect, it } from 'vitest';
import {
  UOM_DROPDOWN_MAX_OPTIONS,
  uomUsesDropdown,
  type NumericUomSpec,
} from '../src/lib/composables/useNumericInput.svelte.js';

const opts = (n: number) => Array.from({ length: n }, (_, i) => ({ code: `u${i}` }));

describe('uomUsesDropdown', () => {
  it('is false with no spec or no options', () => {
    expect(uomUsesDropdown(undefined)).toBe(false);
    expect(uomUsesDropdown({ kind: 'percent', symbol: '%' })).toBe(false);
    expect(
      uomUsesDropdown({ kind: 'currency', code: 'EUR', on_pick: () => {} }),
    ).toBe(false);
  });

  it('is false for an empty option set', () => {
    expect(uomUsesDropdown({ kind: 'custom', code: 'm', options: [] })).toBe(false);
  });

  it('is true at and under the dropdown bound', () => {
    for (const n of [1, UOM_DROPDOWN_MAX_OPTIONS - 1, UOM_DROPDOWN_MAX_OPTIONS]) {
      const spec: NumericUomSpec = { kind: 'custom', code: 'u0', options: opts(n) };
      expect(uomUsesDropdown(spec), `n=${n}`).toBe(true);
    }
  });

  it('is false above the bound — larger sets go through on_pick', () => {
    const spec: NumericUomSpec = {
      kind: 'custom',
      code: 'u0',
      options: opts(UOM_DROPDOWN_MAX_OPTIONS + 1),
      on_pick: () => {},
    };
    expect(uomUsesDropdown(spec)).toBe(false);
  });
});
