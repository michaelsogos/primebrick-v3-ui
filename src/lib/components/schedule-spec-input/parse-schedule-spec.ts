/**
 * NATS `Nats-Schedule` grammar parser for `schedule_spec` values.
 *
 * The schedule string goes verbatim into the NATS header — three branches:
 *   `@every <duration>`  — fixed interval (e.g. `@every 30s`, `@every 5m`, `@every 1d`)
 *   `@at <RFC3339>`      — one-shot at an absolute time (BE classifies it `schedule_type: "once"`)
 *   `<5-field cron>`     — calendar recurrence (e.g. `*\/5 * * * *`)
 *
 * `parseScheduleSpec` is the closed validation entry point; `nextRuns`
 * computes the next occurrences for the interpreter strip (cron via
 * croner, `@every` via arithmetic, `@at` one-shot).
 */
import { Cron } from 'croner';
import { toString as describeCron } from 'cronstrue/dist/cronstrue-i18n.js';

export type ScheduleSpec =
  | { kind: 'every'; everyMs: number; spec: string }
  | { kind: 'at'; at: Date; spec: string }
  | { kind: 'cron'; expr: string; spec: string };

export type ParsedScheduleSpec =
  | { ok: true; spec: ScheduleSpec }
  | { ok: false; reason: string };

const EVERY_UNITS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

const EVERY_RE = /^@every\s+(\d+)([smhd])$/;

function parseEvery(spec: string): ParsedScheduleSpec {
  const m = EVERY_RE.exec(spec);
  if (!m) {
    return {
      ok: false,
      reason: '@every requires a duration like "30s", "5m", "1h" or "1d"',
    };
  }
  return { ok: true, spec: { kind: 'every', everyMs: Number(m[1]) * EVERY_UNITS[m[2]!]!, spec } };
}

function parseAt(spec: string): ParsedScheduleSpec {
  const rest = spec.slice(3).trim();
  const at = new Date(rest);
  if (rest === '' || Number.isNaN(at.getTime())) {
    return { ok: false, reason: '@at requires an RFC3339 timestamp like "2025-12-01T09:00:00Z"' };
  }
  return { ok: true, spec: { kind: 'at', at, spec } };
}

function parseCron(spec: string): ParsedScheduleSpec {
  const parts = spec.split(/\s+/);
  if (parts.length !== 5) {
    return { ok: false, reason: 'cron must have exactly 5 fields (minute hour day month weekday)' };
  }
  try {
    new Cron(spec); // validates ranges/syntax — throws with a precise message
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'invalid cron expression' };
  }
  return { ok: true, spec: { kind: 'cron', expr: spec, spec } };
}

/** Parse a `schedule_spec` string against the NATS grammar. */
export function parseScheduleSpec(raw: string): ParsedScheduleSpec {
  const spec = raw.trim();
  if (spec === '') return { ok: false, reason: 'schedule is required' };
  if (spec.startsWith('@every')) return parseEvery(spec);
  if (spec.startsWith('@at')) return parseAt(spec);
  if (spec.startsWith('@')) return { ok: false, reason: `unknown @-schedule "${spec.split(/\s/)[0]}"` };
  return parseCron(spec);
}

/** Next occurrences — `[]` for invalid specs and past `@at` one-shots. */
export function nextScheduleRuns(raw: string, count = 3, from = new Date()): Date[] {
  const parsed = parseScheduleSpec(raw);
  if (!parsed.ok) return [];
  const s = parsed.spec;
  if (s.kind === 'at') return s.at.getTime() > from.getTime() ? [s.at] : [];
  if (s.kind === 'every') {
    const out: Date[] = [];
    let t = from.getTime() + s.everyMs;
    for (let i = 0; i < count; i++) {
      out.push(new Date(t));
      t += s.everyMs;
    }
    return out;
  }
  try {
    return new Cron(s.expr).nextRuns(count, from);
  } catch {
    return [];
  }
}

/**
 * Human description of a valid spec — a STRUCTURED descriptor so the
 * component translates `@every`/`@at` through its own i18n keys
 * (plural-aware units), while cron text comes from cronstrue already
 * localized (`locale` = full tag like `it-IT`, cronstrue takes the
 * primary subtag). `undefined` when the spec is invalid.
 */
export type ScheduleDescription =
  | { kind: 'every'; n: number; unit: 's' | 'm' | 'h' | 'd' }
  | { kind: 'at'; at: Date }
  | { kind: 'text'; text: string };

export function describeScheduleSpec(raw: string, locale?: string): ScheduleDescription | undefined {
  const parsed = parseScheduleSpec(raw);
  if (!parsed.ok) return undefined;
  const s = parsed.spec;
  if (s.kind === 'at') return { kind: 'at', at: s.at };
  if (s.kind === 'every') {
    const m = EVERY_RE.exec(s.spec)!;
    return { kind: 'every', n: Number(m[1]), unit: m[2] as 's' | 'm' | 'h' | 'd' };
  }
  try {
    try {
      return { kind: 'text', text: describeCron(s.expr, { locale: locale?.split('-')[0] }) };
    } catch {
      // Unknown locale code or expression — degrade to the raw expr text.
      return { kind: 'text', text: s.expr };
    }
  } catch {
    return { kind: 'text', text: s.expr };
  }
}
