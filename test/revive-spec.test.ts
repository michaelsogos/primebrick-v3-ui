import { describe, expect, it } from 'vitest';
import {
	describeReviveAxis,
	parseReviveAxisSpec,
	reviveIntervalCanonical,
} from '../src/lib/utils/revive-spec.js';

describe('reviveIntervalCanonical', () => {
	it('emits singular exactly when count is 1', () => {
		expect(reviveIntervalCanonical(1, 'year')).toBe('1 year');
		expect(reviveIntervalCanonical(1, 'day')).toBe('1 day');
	});

	it('emits plural for counts above 1', () => {
		expect(reviveIntervalCanonical(2, 'year')).toBe('2 years');
		expect(reviveIntervalCanonical(13, 'day')).toBe('13 days');
		expect(reviveIntervalCanonical(3, 'month')).toBe('3 months');
		expect(reviveIntervalCanonical(2, 'quarter')).toBe('2 quarters');
		expect(reviveIntervalCanonical(4, 'week')).toBe('4 weeks');
	});

	it('floors to a positive integer — the grammar is \d+', () => {
		expect(reviveIntervalCanonical(0, 'year')).toBe('1 year');
		expect(reviveIntervalCanonical(2.9, 'year')).toBe('2 years');
	});

	it('round-trips through the core wire parser on both axes', () => {
		for (const count of [1, 2, 5]) {
			for (const unit of ['day', 'week', 'month', 'quarter', 'year'] as const) {
				const canonical = reviveIntervalCanonical(count, unit);
				const atParsed = parseReviveAxisSpec(canonical, 'at');
				expect(atParsed).toMatchObject({ kind: 'interval', count, unit });
				const untilParsed = parseReviveAxisSpec(canonical, 'until');
				expect(untilParsed).toMatchObject({ kind: 'interval', count, unit });
			}
		}
	});
});

describe('parseReviveAxisSpec', () => {
	it('accepts axis-correct instant literals', () => {
		const at = parseReviveAxisSpec('at 2028-06-16T00:00:00.000Z', 'at');
		expect(at?.kind).toBe('at');
		const until = parseReviveAxisSpec('until 2028-06-16T00:00:00.000Z', 'until');
		expect(until?.kind).toBe('at');
	});

	it('rejects cross-axis keywords — the control never emits them', () => {
		expect(parseReviveAxisSpec('until 2028-06-16T00:00:00.000Z', 'at')).toBeNull();
		expect(parseReviveAxisSpec('at 2028-06-16T00:00:00.000Z', 'until')).toBeNull();
	});

	it('trims surrounding whitespace', () => {
		expect(parseReviveAxisSpec('  1 year  ', 'at')).toMatchObject({ kind: 'interval', count: 1 });
	});

	it('returns null for empty and foreign shapes', () => {
		expect(parseReviveAxisSpec('', 'at')).toBeNull();
		expect(parseReviveAxisSpec('   ', 'at')).toBeNull();
		expect(parseReviveAxisSpec('@every 1d', 'at')).toBeNull();
		expect(parseReviveAxisSpec('*/5 * * * *', 'at')).toBeNull();
		expect(parseReviveAxisSpec('1 minute', 'at')).toBeNull();
	});
});

describe('describeReviveAxis', () => {
	it('classifies empty first-class — NULL carries semantics', () => {
		expect(describeReviveAxis('', 'at')).toEqual({ kind: 'empty' });
		expect(describeReviveAxis('   ', 'until')).toEqual({ kind: 'empty' });
	});

	it('classifies intervals with count and unit', () => {
		expect(describeReviveAxis('2 years', 'at')).toMatchObject({ kind: 'interval', n: 2, unit: 'year' });
	});

	it('classifies pins with the absolute instant', () => {
		const d = describeReviveAxis('at 2028-06-16T00:00:00.000Z', 'at');
		expect(d.kind).toBe('pin');
		if (d.kind === 'pin') expect(d.at.toISOString()).toBe('2028-06-16T00:00:00.000Z');
	});

	it('classifies anything else invalid', () => {
		expect(describeReviveAxis('@every 1d', 'at')).toEqual({ kind: 'invalid' });
		expect(describeReviveAxis('until 2028-06-16T00:00:00.000Z', 'at')).toEqual({ kind: 'invalid' });
		expect(describeReviveAxis('x year', 'until')).toEqual({ kind: 'invalid' });
	});
});
