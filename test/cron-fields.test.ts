import { describe, expect, it } from 'vitest';
import {
	CRON_FIELDS,
	acceptChar,
	distributePaste,
	emitExpression,
	collapseWildcardStep,
	expandStepPrefix,
	normalizeDigits,
	normalizeToken,
	validateFieldToken,
} from '../src/lib/components/cron-input/cron-fields.js';

const [minute, hour, dom, month, dow] = CRON_FIELDS;

describe('validateFieldToken', () => {
	it('accepts wildcards, lists, ranges and steps', () => {
		expect(validateFieldToken(minute, '*')).toBe(true);
		expect(validateFieldToken(minute, '*/5')).toBe(true);
		expect(validateFieldToken(minute, '0,15,30,45')).toBe(true);
		expect(validateFieldToken(minute, '0-30')).toBe(true);
		expect(validateFieldToken(minute, '9-17/2')).toBe(true);
	});
	it('rejects out-of-range numbers per field', () => {
		expect(validateFieldToken(minute, '60')).toBe(false);
		expect(validateFieldToken(hour, '24')).toBe(false);
		expect(validateFieldToken(dom, '0')).toBe(false);
		expect(validateFieldToken(dom, '32')).toBe(false);
		expect(validateFieldToken(month, '13')).toBe(false);
		expect(validateFieldToken(dow, '8')).toBe(false);
	});
	it('rejects out-of-range numbers inside compound tokens', () => {
		expect(validateFieldToken(minute, '0-70')).toBe(false);
		expect(validateFieldToken(hour, '1,99')).toBe(false);
	});
	it('digits only — names are invalid in EVERY field (universal subset)', () => {
		expect(validateFieldToken(month, 'JAN-MAR')).toBe(false);
		expect(validateFieldToken(dow, 'MON-FRI')).toBe(false);
		expect(validateFieldToken(dow, 'SUN')).toBe(false);
		expect(validateFieldToken(minute, 'JAN')).toBe(false);
	});
	it('digits only — quartz extras are invalid in EVERY field (NATS subset)', () => {
		expect(validateFieldToken(dom, '?')).toBe(false);
		expect(validateFieldToken(dom, 'L')).toBe(false);
		expect(validateFieldToken(dom, '15W')).toBe(false);
		expect(validateFieldToken(dow, '?')).toBe(false);
		expect(validateFieldToken(dow, '5L')).toBe(false);
		expect(validateFieldToken(dow, '3#2')).toBe(false);
	});
	it('rejects malformed segments', () => {
		expect(validateFieldToken(minute, 'hello')).toBe(false);
		expect(validateFieldToken(minute, ',')).toBe(false);
		expect(validateFieldToken(minute, '5-')).toBe(false);
		expect(validateFieldToken(minute, '-5')).toBe(false);
		expect(validateFieldToken(minute, '*/')).toBe(false);
		expect(validateFieldToken(minute, '//5')).toBe(false);
		expect(validateFieldToken(minute, '1/2/3')).toBe(false);
		expect(validateFieldToken(minute, '*/x')).toBe(false);
	});
	it('treats an empty token as still-typing (valid)', () => {
		expect(validateFieldToken(minute, '')).toBe(true);
	});
	it('`/5` is legal shorthand for `*/5` — step on the implied wildcard', () => {
		expect(validateFieldToken(minute, '/5')).toBe(true);
		expect(validateFieldToken(hour, '/2')).toBe(true);
		expect(validateFieldToken(minute, '5,/2')).toBe(true);
	});
});

describe('acceptChar — the field-aware keystroke mask', () => {
	it('rejects ALL letters in EVERY field — digits only', () => {
		for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
			for (const f of CRON_FIELDS) {
				expect(acceptChar(f, '', ch), `${f.key} rejects ${ch}`).toBe(false);
			}
		}
	});
	it('rejects quartz extras in EVERY field — ? L W # untypeable', () => {
		for (const ch of ['?', '#', 'L', 'W']) {
			for (const f of CRON_FIELDS) {
				expect(acceptChar(f, '', ch), `${f.key} rejects ${ch}`).toBe(false);
				expect(acceptChar(f, '5', ch), `${f.key} rejects 5+${ch}`).toBe(false);
			}
		}
	});
	it('accepts operators and in-range digits', () => {
		for (const ch of ['*', ',', '-', '/']) {
			for (const f of CRON_FIELDS) expect(acceptChar(f, '', ch)).toBe(true);
		}
		// '9' types only where 9 is a possible value (not dow 0-7).
		for (const f of [minute, hour, dom, month]) expect(acceptChar(f, '', '9')).toBe(f.max >= 9);
		// '0' types everywhere — the relaxed mask lets `00`/`05` through and
		// normalizeDigits collapses them (`09`→`9`, `00`→`0`, `0`→flagged in 1-based).
		for (const f of CRON_FIELDS) expect(acceptChar(f, '', '0')).toBe(true);
	});
	it('spaces and punctuation never enter a draft', () => {
		expect(acceptChar(minute, '5', ' ')).toBe(false);
		expect(acceptChar(minute, '5', '@')).toBe(false);
		expect(acceptChar(minute, '5', '.')).toBe(false);
	});
	it('digit runs are capped at maxDigits and ≤ max — out-of-range untypeable', () => {
		expect(acceptChar(minute, '9', '9')).toBe(false); // 99 > 59
		expect(acceptChar(minute, '6', '0')).toBe(false); // 60 > 59
		expect(acceptChar(minute, '59', '9')).toBe(false); // 3 digits > maxDigits 2
		expect(acceptChar(hour, '2', '4')).toBe(false); // 24 > 23
		expect(acceptChar(dom, '3', '2')).toBe(false); // 32 > 31
		expect(acceptChar(month, '1', '3')).toBe(false); // 13 > 12
		expect(acceptChar(dow, '1', '7')).toBe(false); // 17 > 7 (maxDigits 1)
		expect(acceptChar(minute, '5', '9')).toBe(true); // 59
		expect(acceptChar(minute, '', '6')).toBe(true);
		expect(acceptChar(hour, '2', '3')).toBe(true); // 23
		expect(acceptChar(dow, '', '7')).toBe(true); // 7 = sunday alias
		// Leading zeros type then normalize — '05'→5, '00'→0.
		expect(acceptChar(minute, '0', '5')).toBe(true); // '05' → '5'
		expect(acceptChar(minute, '0', '0')).toBe(true); // '00' → '0'
		expect(acceptChar(month, '0', '9')).toBe(true); // '09' → '9'
		// Operators reset the run — '0-9' types cleanly.
		expect(acceptChar(dom, '0-', '9')).toBe(true);
		expect(acceptChar(dom, '10-', '3')).toBe(true);
		expect(acceptChar(dom, '10-3', '1')).toBe(true); // 31
	});
});

describe('normalizeDigits — OTP zero-collapse', () => {
	it('collapses leading zeros in every digit run', () => {
		expect(normalizeDigits('00')).toBe('0');
		expect(normalizeDigits('05')).toBe('5');
		expect(normalizeDigits('09-15')).toBe('9-15');
		expect(normalizeDigits('0-05,08')).toBe('0-5,8');
		expect(normalizeDigits('*/05')).toBe('*/5');
	});
	it('leaves canonical values untouched', () => {
		expect(normalizeDigits('59')).toBe('59');
		expect(normalizeDigits('0')).toBe('0');
	});
});

describe('expandStepPrefix — `/x` implies `*/x`', () => {
	it('expands a leading slash to `*/`', () => {
		expect(expandStepPrefix('/5')).toBe('*/5');
		expect(expandStepPrefix('/2')).toBe('*/2');
	});
	it('expands slashes after a comma boundary', () => {
		expect(expandStepPrefix('5,/2')).toBe('5,*/2');
		expect(expandStepPrefix('/5,/10')).toBe('*/5,*/10');
	});
	it('leaves real steps and wildcards untouched', () => {
		expect(expandStepPrefix('*/5')).toBe('*/5');
		expect(expandStepPrefix('5/2')).toBe('5/2');
		expect(expandStepPrefix('9-17/2')).toBe('9-17/2');
	});
});

describe('collapseWildcardStep — `*/1` IS `*`', () => {
	it('collapses wildcard step-1 to the bare wildcard', () => {
		expect(collapseWildcardStep('*/1')).toBe('*');
		expect(collapseWildcardStep('5,*/1')).toBe('5,*');
		expect(normalizeToken('/1')).toBe('*'); // /1 → */1 → *
	});
	it('keeps real steps — */10, 5/1 are not `*`', () => {
		expect(collapseWildcardStep('*/10')).toBe('*/10');
		expect(collapseWildcardStep('*/19')).toBe('*/19');
		expect(collapseWildcardStep('5/1')).toBe('5/1');
	});
});

describe('distributePaste', () => {
	it('a 5-token paste fills all fields', () => {
		expect(distributePaste(['', '', '', '', ''], '*/15 9-17 1,15 1 1-5', 2)).toEqual([
			'*/15',
			'9-17',
			'1,15',
			'1',
			'1-5',
		]);
	});
	it('a short paste fills forward from the focused field', () => {
		expect(distributePaste(['*', '', '', '', ''], '9-17 *', 1)).toEqual([
			'*',
			'9-17',
			'*',
			'',
			'',
		]);
	});
	it('letters pass the cleaner so invalid pasted names flag red', () => {
		// Names are NOT silently dropped — they land and validateFieldToken
		// marks them invalid, so the user sees what to fix.
		expect(distributePaste(['', '', '', '', ''], '0 9 * jan mon', 0)).toEqual([
			'0',
			'9',
			'*',
			'JAN',
			'MON',
		]);
	});
	it('expands `/n` step shorthands in pasted tokens', () => {
		expect(distributePaste(['', '', '', '', ''], '/15 9 * * 1-5', 0)).toEqual([
			'*/15',
			'9',
			'*',
			'*',
			'1-5',
		]);
	});
	it('empty paste is a no-op', () => {
		const d = ['1', '', '', '', ''];
		expect(distributePaste(d, '   ', 0)).toBe(d);
	});
});

describe('emitExpression — empty field IS the `*` wildcard', () => {
	it('fills every empty slot with * — always a canonical 5-field expr', () => {
		expect(emitExpression(['0', '9', '*', '', ''])).toBe('0 9 * * *');
		expect(emitExpression(['', '', '', '', '1'])).toBe('* * * * 1');
		expect(emitExpression(['5', '', '1'])).toBe('5 * 1');
	});
	it('all-empty is `* * * * *` — every minute, the empty=* consequence', () => {
		expect(emitExpression(['', '', '', '', ''])).toBe('* * * * *');
	});
});
