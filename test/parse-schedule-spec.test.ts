import { describe, expect, it } from 'vitest';
import {
  describeScheduleSpec,
  nextScheduleRuns,
  parseScheduleSpec,
} from '../src/lib/components/schedule-spec-input/parse-schedule-spec.js';

describe('parseScheduleSpec', () => {
  it('parses @every durations', () => {
    for (const [spec, ms] of [
      ['@every 30s', 30_000],
      ['@every 5m', 300_000],
      ['@every 2h', 7_200_000],
      ['@every 1d', 86_400_000],
    ] as const) {
      const r = parseScheduleSpec(spec);
      expect(r.ok, spec).toBe(true);
      if (r.ok) expect(r.spec).toMatchObject({ kind: 'every', everyMs: ms });
    }
  });

  it('parses @at RFC3339', () => {
    const r = parseScheduleSpec('@at 2025-12-01T09:00:00Z');
    expect(r.ok).toBe(true);
    if (r.ok && r.spec.kind === 'at') {
      expect(r.spec.at.toISOString()).toBe('2025-12-01T09:00:00.000Z');
    }
  });

  it('parses 5-field cron', () => {
    for (const spec of ['*/5 * * * *', '0 9 * * 1-5', '15 3 1 * *']) {
      const r = parseScheduleSpec(spec);
      expect(r.ok, spec).toBe(true);
      if (r.ok) expect(r.spec).toMatchObject({ kind: 'cron', expr: spec });
    }
  });

  it('rejects empty and unknown @-schedules', () => {
    expect(parseScheduleSpec('').ok).toBe(false);
    expect(parseScheduleSpec('   ').ok).toBe(false);
    expect(parseScheduleSpec('@daily').ok).toBe(false);
    expect(parseScheduleSpec('@foo bar').ok).toBe(false);
  });

  it('rejects malformed @every / @at / cron', () => {
    for (const bad of [
      '@every',
      '@every 5',
      '@every 5w', // weeks not in NATS grammar
      '@every xm',
      '@at',
      '@at not-a-date',
      '* * * *', // 4 fields
      '61 * * * *', // minute out of range
      '* * * * * *', // 6 fields — NATS grammar is 5
    ]) {
      expect(parseScheduleSpec(bad).ok, bad).toBe(false);
    }
  });
});

describe('nextScheduleRuns', () => {
  const from = new Date('2026-10-27T12:00:00Z');

  it('@every produces arithmetic runs', () => {
    const runs = nextScheduleRuns('@every 5m', 3, from);
    expect(runs.map((d) => d.toISOString())).toEqual([
      '2026-10-27T12:05:00.000Z',
      '2026-10-27T12:10:00.000Z',
      '2026-10-27T12:15:00.000Z',
    ]);
  });

  it('@at yields the single future occurrence, [] when past', () => {
    expect(nextScheduleRuns('@at 2026-10-28T00:00:00Z', 3, from)).toHaveLength(1);
    expect(nextScheduleRuns('@at 2026-10-26T00:00:00Z', 3, from)).toEqual([]);
  });

  it('cron produces croner runs', () => {
    const runs = nextScheduleRuns('*/30 * * * *', 2, from);
    expect(runs.map((d) => d.toISOString())).toEqual([
      '2026-10-27T12:30:00.000Z',
      '2026-10-27T13:00:00.000Z',
    ]);
  });

  it('returns [] on invalid specs', () => {
    expect(nextScheduleRuns('garbage', 3, from)).toEqual([]);
  });
});

describe('describeScheduleSpec', () => {
  it('describes each branch', () => {
    expect(describeScheduleSpec('@every 5m')).toBe('Every 5 minutes');
    expect(describeScheduleSpec('@at 2026-10-28T00:00:00Z')).toContain('2026-10-28');
    expect(describeScheduleSpec('*/5 * * * *')).toBe('Every 5 minutes');
  });

  it('returns undefined on invalid specs', () => {
    expect(describeScheduleSpec('nope')).toBeUndefined();
  });
});
