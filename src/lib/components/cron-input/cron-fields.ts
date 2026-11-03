/**
 * 5-field cron grammar (minute hour day-of-month month weekday) shared by
 * `CronInput`: field metadata, per-field validation and the input mask.
 * Vocabulary: **digits + `*` `,` `-` `/` only** — the strict subset that
 * every downstream runtime (NATS `Nats-Schedule`) understands. No month or
 * weekday names, no quartz extras (`?`/`L`/`W`/`#`): digits are universal
 * and self-describing, and the editor grammar stays a SUBSET of the
 * runtime's — never a superset.
 */

export type CronFieldKey = 'minute' | 'hour' | 'day_of_month' | 'month' | 'weekday';

export interface CronFieldMeta {
	key: CronFieldKey;
	/** i18n key for the field label (`app.widgets.cron_input.field.*`). */
	label_key: string;
	/** i18n key for the ≤4-char localized UOM abbreviation under the cell. */
	uom_key: string;
	/** Real token per operator, contextual to this field — rendered inside the legend rows and clickable (fills the cell). */
	examples: { comma: string; dash: string; slash: string };
	/** Literal range hint shown in the legend, e.g. `0-59` or `1-12`. */
	range_hint: string;
	min: number;
	max: number;
}

export const CRON_FIELDS: readonly CronFieldMeta[] = [
	{
		key: 'minute',
		label_key: 'app.widgets.cron_input.field.minute',
		uom_key: 'app.widgets.cron_input.field.minute.short',
		examples: { comma: '0,30', dash: '5-20', slash: '*/15' },
		range_hint: '0-59',
		min: 0,
		max: 59,
	},
	{
		key: 'hour',
		label_key: 'app.widgets.cron_input.field.hour',
		uom_key: 'app.widgets.cron_input.field.hour.short',
		examples: { comma: '8,18', dash: '9-17', slash: '*/4' },
		range_hint: '0-23',
		min: 0,
		max: 23,
	},
	{
		key: 'day_of_month',
		label_key: 'app.widgets.cron_input.field.day_of_month',
		uom_key: 'app.widgets.cron_input.field.day_of_month.short',
		examples: { comma: '1,15', dash: '10-20', slash: '*/2' },
		range_hint: '1-31',
		min: 1,
		max: 31,
	},
	{
		key: 'month',
		label_key: 'app.widgets.cron_input.field.month',
		uom_key: 'app.widgets.cron_input.field.month.short',
		examples: { comma: '3,9', dash: '1-6', slash: '*/3' },
		range_hint: '1-12',
		min: 1,
		max: 12,
	},
	{
		key: 'weekday',
		label_key: 'app.widgets.cron_input.field.weekday',
		uom_key: 'app.widgets.cron_input.field.weekday.short',
		examples: { comma: '0,6', dash: '1-5', slash: '*/2' },
		range_hint: '0-7',
		min: 0,
		max: 7,
	},
];

const STEP_RE = /^\d+$/;

function atomOk(f: CronFieldMeta, a: string): boolean {
	if (!/^\d+$/.test(a)) return false;
	const n = Number(a);
	return n >= f.min && n <= f.max;
}

function segmentOk(f: CronFieldMeta, seg: string): boolean {
	if (seg === '*') return true;
	const parts = seg.split('/');
	if (parts.length > 2) return false;
	const [base, step] = parts;
	if (step !== undefined && !STEP_RE.test(step)) return false;
	if (base === '*') return step !== undefined; // `*/n` only — bare `*` handled above
	const dash = base.indexOf('-');
	if (dash === -1) return atomOk(f, base);
	return atomOk(f, base.slice(0, dash)) && atomOk(f, base.slice(dash + 1));
}

/** Whole-field validity — every `,`-segment must be a legal cron atom/range/step. */
export function validateFieldToken(f: CronFieldMeta, token: string): boolean {
	if (token === '') return true; // still typing
	return expandStepPrefix(token)
		.split(',')
		.every((s) => s !== '' && segmentOk(f, s));
}

/**
 * Digit-run acceptance: the digits typed since the last non-digit char +
 * this new digit must fit the field — max `String(max).length` digits and
 * numeric value ≤ `max`. Out-of-range numbers are physically untypeable
 * (`60`→`6`, `9999`→`9`, `13` in month→`1`); leading zeros ARE typeable
 * (`00`, `05`, `09`) because `normalizeDigits` collapses them to the
 * canonical value on the fly (`00`→`0`, `05`→`5`).
 */
function digitRunOk(f: CronFieldMeta, draft: string, ch: string): boolean {
	const run = draft.match(/[0-9]*$/)?.[0] ?? '';
	const candidate = run + ch;
	return candidate.length <= String(f.max).length && Number(candidate) <= f.max;
}

/** Canonical numeric form — strip leading zeros inside every digit run. */
export function normalizeDigits(token: string): string {
	return token.replace(/\d+/g, (m) => String(Number(m)));
}

/**
 * `/` at a segment start means `&#42;/` — the wildcard is implied
 * (`/5` ≡ `&#42;/5`, `9,/2` ≡ `9,&#42;/2`). Expand it so drafts always
 * carry the canonical, self-teaching form.
 */
export function expandStepPrefix(token: string): string {
	return token.replace(/(^|,)\//g, '$1*/');
}

/**
 * `*\/1` IS `*` — every 1 of every unit is every unit. Canonicalize so the
 * draft teaches the idiom (`/1` typed → `*` shown). Only the wildcard base
 * collapses: `5/1` ≠ `5` (5-59 every 1). Lookahead guards `*\/10`-`*\/19`.
 */
export function collapseWildcardStep(token: string): string {
	return token.replace(/(^|,)\*\/1(?!\d)/g, '$1*');
}

/** Full per-token canonicalization — used by keystroke mask and paste. */
export function normalizeToken(token: string): string {
	return collapseWildcardStep(normalizeDigits(expandStepPrefix(token)));
}

/** Trailing digit-run length — the OTP auto-advance trigger. */
export function digitRunLength(token: string): number {
	return token.match(/[0-9]*$/)?.[0].length ?? 0;
}

/** Chars that can never START a field — they continue the previous token.
 *  (`/` is NOT here: `/5` legally means `&#42;/5` — it starts a step.) */
export const CONTINUATION_CHARS = new Set(['-', ',']);

/**
 * Field-aware keystroke filter — the REAL mask of the segmented editor.
 * `ch` is a single char about to be appended to `draft` (already typed so
 * far). Digits + `*` `,` `-` `/` only — letters, quartz extras, spaces and
 * punctuation are dropped at keystroke.
 */
export function acceptChar(f: CronFieldMeta, draft: string, ch: string): boolean {
	if (/[0-9]/.test(ch)) return digitRunOk(f, draft, ch);
	return ch === '*' || ch === ',' || ch === '-' || ch === '/';
}

/**
 * Fan-out a pasted expression into field drafts. A 5-token paste fills all
 * fields; shorter pastes fill forward starting at `fromIdx`.
 */
export function distributePaste(drafts: string[], pasted: string, fromIdx: number): string[] {
	// Keep letters/quartz chars through the cleaner so invalid pasted tokens
	// land and get flagged — stripping them would silently drop fields.
	const cleaned = pasted
		.toUpperCase()
		.replace(/[^0-9*\-/,?#A-Z\s]/g, ' ')
		.trim();
	const tokens = cleaned.split(/\s+/).filter((t) => t !== '').map(normalizeToken);
	if (tokens.length === 0) return drafts;
	const next = [...drafts];
	if (tokens.length >= CRON_FIELDS.length) {
		for (let i = 0; i < CRON_FIELDS.length; i++) next[i] = tokens[i];
		return next;
	}
	for (let t = 0; t < tokens.length && fromIdx + t < CRON_FIELDS.length; t++) {
		next[fromIdx + t] = tokens[t];
	}
	return next;
}

/**
 * Emit the canonical 5-field expression — an empty field IS the `*`
 * wildcard (`* * * * *` when untouched, `5 * * * *` after typing only a
 * minute). One semantic everywhere: draft, preview, validity, emission.
 */
export function emitExpression(drafts: string[]): string {
	return drafts.map((d) => (d === '' ? '*' : d)).join(' ');
}
