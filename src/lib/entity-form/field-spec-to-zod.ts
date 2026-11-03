/**
 * `fieldSpecToZod` — the FORM-binding projection of a `MetaColumn` onto a
 * zod chain.
 *
 * The semantic rules are NOT re-implemented here: every constraint
 * (bounds, pattern, formats, badge vocabulary, `json_schema`) is evaluated
 * by the core `checkFieldValue` predicate — the same predicate the
 * wire-side `entityFieldValidator` runs for BE/US writes. A rule added to
 * the shared engine cannot drift between form and transport.
 *
 * What this file owns is only the binding adaptation:
 *   - `boolean` columns bind native booleans;
 *   - numeric formats / numeric pg types bind numbers;
 *   - `json`-format / json(b) columns bind a STRING (the control's raw
 *     text) — it is parsed once, then checked on the parsed value;
 *   - everything else binds a string.
 *
 * Required-ness is an explicit option: `required: true` wraps the string
 * binding with `.min(1)` — an empty string is a present-but-empty value.
 * Optional fields are wrapped by the CALLER in a `'' → undefined`
 * preprocess so an untouched control submits `undefined`, matching the
 * wire contract.
 */
import { z } from 'zod';
import { checkFieldValue, extJsonParse, type MetaColumn } from '@primebrick/core';

function emitIssues(col: MetaColumn, value: unknown, ctx: z.RefinementCtx): void {
	for (const i of checkFieldValue(col, value)) {
		ctx.addIssue({ code: 'custom', message: i.message });
	}
}

export function fieldSpecToZod(
	col: MetaColumn,
	opts: { required?: boolean } = {},
): z.ZodTypeAny {
	const format = col.format;
	const pg = col.pg_type;
	const type = col.type;

	if (type === 'boolean' || pg === 'boolean') {
		return z.boolean().superRefine((v, ctx) => emitIssues(col, v, ctx));
	}
	if (
		format === 'number' ||
		format === 'money' ||
		pg === 'integer' ||
		pg === 'bigint' ||
		pg === 'numeric'
	) {
		return z.number().superRefine((v, ctx) => emitIssues(col, v, ctx));
	}
	if (format === 'json' || pg === 'jsonb' || pg === 'json') {
		// The control binds a JSON string; the parsed value is checked by
		// the shared predicate (json_schema + friends). Parsed at submit.
		let s = z.string();
		if (opts.required) s = s.min(1);
		return s.superRefine((raw, ctx) => {
			const trimmed = raw.trim();
			if (trimmed.length === 0) return; // emptiness handled by the required wrap
			try {
				emitIssues(col, extJsonParse(trimmed), ctx);
			} catch {
				ctx.addIssue({ code: 'custom', message: 'invalid JSON' });
			}
		});
	}

	let s = z.string();
	if (opts.required) s = s.min(1);
	return s.superRefine((v, ctx) => emitIssues(col, v, ctx));
}
