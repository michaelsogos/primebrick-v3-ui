import { afterEach, describe, expect, it } from 'vitest';
import { CalendarDate, CalendarDateTime } from '@internationalized/date';
import { isWheelSelectionBelowMin } from '../src/lib/utils/date-wheel-bounds.js';

const ORIG_TZ = process.env.TZ;
afterEach(() => {
  if (ORIG_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIG_TZ;
});

describe('isWheelSelectionBelowMin — includeTime (instant compare)', () => {
  // 2026-11-05 10:00 wall-clock in Europe/Rome is 09:00Z.
  const wheel = new CalendarDateTime(2026, 11, 5, 10, 0, 0);

  it('refuses an instant before the bound', () => {
    const min = new Date('2026-11-05T09:30:00Z'); // 10:30 in Rome
    expect(isWheelSelectionBelowMin(wheel, min, 'Europe/Rome')).toBe(true);
  });

  it('accepts an instant at/after the bound', () => {
    expect(isWheelSelectionBelowMin(wheel, new Date('2026-11-05T09:00:00Z'), 'Europe/Rome')).toBe(false);
    expect(isWheelSelectionBelowMin(wheel, new Date('2026-11-05T08:00:00Z'), 'Europe/Rome')).toBe(false);
  });

  it('the picked zone changes the instant — same wheels, different verdict', () => {
    const min = new Date('2026-11-05T09:30:00Z');
    // 10:00 in Rome = 09:00Z → below. 10:00 UTC = 10:00Z → above.
    expect(isWheelSelectionBelowMin(wheel, min, 'Europe/Rome')).toBe(true);
    expect(isWheelSelectionBelowMin(wheel, min, 'UTC')).toBe(false);
  });

  it('no bound → never below', () => {
    expect(isWheelSelectionBelowMin(wheel, undefined, 'UTC')).toBe(false);
    expect(isWheelSelectionBelowMin(wheel, null, 'UTC')).toBe(false);
  });
});

describe('isWheelSelectionBelowMin — date-only (calendar-day compare)', () => {
  it('refuses a calendar day before the bound day', () => {
    const min = new Date('2026-11-05T12:00:00');
    expect(isWheelSelectionBelowMin(new CalendarDate(2026, 11, 4), min)).toBe(true);
    expect(isWheelSelectionBelowMin(new CalendarDate(2026, 11, 5), min)).toBe(false);
    expect(isWheelSelectionBelowMin(new CalendarDate(2026, 11, 6), min)).toBe(false);
  });
});
