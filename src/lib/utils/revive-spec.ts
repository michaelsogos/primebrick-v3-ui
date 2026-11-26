/**
 * revive-spec — pure helpers backing `ReviveIntervalInput`.
 *
 * The wire grammar lives in `@primebrick/core` (`parseReviveSpec` /
 * `parseGraceSpec`) — the SAME predicate the DAL wire validator runs, so
 * the widget's live interpretation can never drift from what the write
 * path accepts. This module adds the two things core deliberately does
 * not own:
 *
 *   - canonical emission from builder state (`'1 year'` / `'2 years'` —
 *     singular exactly when count is 1, the round-trip the closed
 *     varchar contract round-trips);
 *   - a structured strip descriptor (empty/interval/pin/invalid) the
 *     interpreter strip translates through `app.widgets.revive_interval.*`
 *     keys — axis-aware copy keys are selected by the component, the
 *     descriptor itself is axis-neutral.
 */
import {
	parseGraceSpec,
	parseReviveSpec,
	type ReviveSpec,
	type SequenceReviveUnit,
} from '@primebrick/core';

/** The instant-literal keyword of the axis — `at` pins `expire_at`
 *  (`revive_every`), `until` pins `switch_at` (`revive_grace`). */
export type ReviveLiteral = 'at' | 'until';

/** Axis-bound parse — trimmed; empty is not a spec (NULL semantics). */
export function parseReviveAxisSpec(raw: string, literal: ReviveLiteral): ReviveSpec | null {
	const text = raw.trim();
	if (text === '') return null;
	return literal === 'at' ? parseReviveSpec(text) : parseGraceSpec(text);
}

/** Canonical interval emission — `'1 year'` singular, `'2 years'` plural.
 *  Counts floor to a positive integer (the grammar is `\d+`, never 0). */
export function reviveIntervalCanonical(count: number, unit: SequenceReviveUnit): string {
	const n = Math.max(1, Math.floor(count));
	return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

/** Strip descriptor — what the interpreter strip renders. */
export type ReviveDescription =
	| { kind: 'empty' }
	| { kind: 'interval'; n: number; unit: SequenceReviveUnit }
	| { kind: 'pin'; at: Date }
	| { kind: 'invalid' };

/** Classify the bound value for the interpreter strip. Empty is first-class:
 *  NULL carries the revive-off / no-grace semantics, the strip says so. */
export function describeReviveAxis(raw: string, literal: ReviveLiteral): ReviveDescription {
	if (raw.trim() === '') return { kind: 'empty' };
	const parsed = parseReviveAxisSpec(raw, literal);
	if (!parsed) return { kind: 'invalid' };
	if (parsed.kind === 'interval') return { kind: 'interval', n: parsed.count, unit: parsed.unit };
	return { kind: 'pin', at: parsed.at };
}
