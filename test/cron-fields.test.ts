import { describe, expect, it } from 'vitest';
import {
	CRON_FIELDS,
	acceptChar,
	distributePaste,
	emitExpression,
	fieldIndexAt,
	fieldStartOffset,
	collapseWildcardStep,
	expandStepPrefix,
	maskCronInput,
	normalizeDigits,
	normalizeToken,
	validateFieldToken,
} from '../src/lib/components/cron-input/cron-fields.js';

const [minute, hour, dom, month, dow] = CRON_FIELDS;

describe('maskCronInput', () => {
	it('strips characters outside the cron alphabet', () => {
		expect(maskCronInput('*/5 @ % & ! * * * *')).toBe('*/5 * * * *');
	});
	it('uppercases name letters', () => {
		expect(maskCronInput('0 9 * jan mon-fri')).toBe('0 9 * JAN MON-FRI');
	});
	it('collapses multiple spaces and trims the lead', () => {
		expect(maskCronInput('  *   *  *')).toBe('* * *');
	});
	it('keeps quartz extras letters/digits', () => {
		expect(maskCronInput('0 0 ? * 2#1')).toBe('0 0 ? * 2#1');
	});
});

describe('fieldIndexAt', () => {
	it('maps caret positions to the 5 fields', () => {
		const expr = '*/15 9-17 1,15 JAN MON';
		//          0123456789...
		expect(fieldIndexAt(expr, 0)).toBe(0);
		expect(fieldIndexAt(expr, 2)).toBe(0); // mid-token minute
		expect(fieldIndexAt(expr, 4)).toBe(0); // on the space → still editing field 0's boundary? — see below
		expect(fieldIndexAt(expr, 5)).toBe(1); // `9-17`
		expect(fieldIndexAt(expr, 10)).toBe(2); // `1,15`
		expect(fieldIndexAt(expr, 15)).toBe(3); // `JAN`
		expect(fieldIndexAt(expr, 19)).toBe(4); // `MON`
		expect(fieldIndexAt(expr, 25)).toBe(4);
	});
	it('clamps beyond the last field', () => {
		expect(fieldIndexAt('1 2 3 4 5 6 7', 13)).toBe(4);
	});
	it('empty expression → first field', () => {
		expect(fieldIndexAt('', 0)).toBe(0);
	});
	it('right after a space → next field', () => {
		expect(fieldIndexAt('* *', 2)).toBe(1);
	});
});

describe('fieldStartOffset', () => {
	it('returns the char offset where each field begins', () => {
		const expr = '*/15 9-17 1,15 JAN MON';
		expect(fieldStartOffset(expr, 0)).toBe(0);
		expect(fieldStartOffset(expr, 1)).toBe(5);
		expect(fieldStartOffset(expr, 2)).toBe(10);
		expect(fieldStartOffset(expr, 3)).toBe(15);
		expect(fieldStartOffset(expr, 4)).toBe(19);
	});
	it('tolerates multiple spaces between fields', () => {
		expect(fieldStartOffset('*   5', 1)).toBe(4);
	});
});

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
	it('accepts month and weekday names in their own fields only', () => {
		expect(validateFieldToken(month, 'JAN-MAR')).toBe(true);
		expect(validateFieldToken(dow, 'MON-FRI')).toBe(true);
		expect(validateFieldToken(dow, 'SUN')).toBe(true);
		expect(validateFieldToken(minute, 'JAN')).toBe(false);
		expect(validateFieldToken(month, 'MON')).toBe(false);
		expect(validateFieldToken(dom, 'SUN')).toBe(false);
	});
	it('accepts quartz extras only in day-of-month / weekday', () => {
		expect(validateFieldToken(dom, '?')).toBe(true);
		expect(validateFieldToken(dom, 'L')).toBe(true);
		expect(validateFieldToken(dom, '15W')).toBe(true);
		expect(validateFieldToken(dow, '?')).toBe(true);
		expect(validateFieldToken(dow, '5L')).toBe(true);
		expect(validateFieldToken(dow, '3#2')).toBe(true);
		expect(validateFieldToken(minute, '?')).toBe(false);
		expect(validateFieldToken(hour, 'L')).toBe(false);
		expect(validateFieldToken(month, '3#2')).toBe(false);
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
	it('numeric fields reject letters entirely', () => {
		for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
			expect(acceptChar(minute, '', ch), `minute rejects ${ch}`).toBe(false);
			expect(acceptChar(hour, '', ch), `hour rejects ${ch}`).toBe(false);
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
	it('month accepts only letters that stay a name prefix', () => {
		// J → JA → JAN is a valid prefix path.
		expect(acceptChar(month, '', 'J')).toBe(true);
		expect(acceptChar(month, 'J', 'A')).toBe(true);
		expect(acceptChar(month, 'JA', 'N')).toBe(true);
		// B/X start no month name → dropped; D is kept (DEC prefix).
		expect(acceptChar(month, '', 'D')).toBe(true);
		expect(acceptChar(month, '', 'B')).toBe(false);
		expect(acceptChar(month, '', 'X')).toBe(false);
		// 'JF' is no prefix (JAN/JUN/JUL only) → dropped.
		expect(acceptChar(month, 'J', 'F')).toBe(false);
		// Second run after '-' resets: 'JAN-F' is valid (FEB prefix).
		expect(acceptChar(month, 'JAN-', 'F')).toBe(true);
	});
	it('weekday accepts SUN-SAT prefixes and quartz L', () => {
		expect(acceptChar(dow, '', 'M')).toBe(true);
		expect(acceptChar(dow, 'M', 'O')).toBe(true);
		expect(acceptChar(dow, 'MO', 'N')).toBe(true);
		expect(acceptChar(dow, '', 'Z')).toBe(false);
		expect(acceptChar(dow, '5', 'L')).toBe(true); // 5L = last Friday
	});
	it('quartz extras only in dom/dow', () => {
		expect(acceptChar(dom, '', '?')).toBe(true);
		expect(acceptChar(dom, '', 'L')).toBe(true);
		expect(acceptChar(dom, '1', 'W')).toBe(true);
		expect(acceptChar(dow, '', '#')).toBe(true);
		expect(acceptChar(minute, '', '?')).toBe(false);
		expect(acceptChar(hour, '', 'L')).toBe(false);
		expect(acceptChar(month, '', '#')).toBe(false);
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
		expect(normalizeDigits('MON-FRI')).toBe('MON-FRI');
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
		expect(distributePaste(['', '', '', '', ''], '*/15 9-17 1,15 JAN MON-FRI', 2)).toEqual([
			'*/15',
			'9-17',
			'1,15',
			'JAN',
			'MON-FRI',
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
	it('strips illegal characters and uppercases names', () => {
		expect(distributePaste(['', '', '', '', ''], '0 9 * jan mon', 0)).toEqual([
			'0',
			'9',
			'*',
			'JAN',
			'MON',
		]);
	});
	it('expands `/n` step shorthands in pasted tokens', () => {
		expect(distributePaste(['', '', '', '', ''], '/15 9 * * MON-FRI', 0)).toEqual([
			'*/15',
			'9',
			'*',
			'*',
			'MON-FRI',
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
		expect(emitExpression(['', '', '', '', 'MON'])).toBe('* * * * MON');
		expect(emitExpression(['5', '', '1'])).toBe('5 * 1');
	});
	it('all-empty is `* * * * *` — every minute, the empty=* consequence', () => {
		expect(emitExpression(['', '', '', '', ''])).toBe('* * * * *');
	});
});
