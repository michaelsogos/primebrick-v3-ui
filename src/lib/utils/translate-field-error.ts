/**
 * `translateFieldError` — decode the shared field-error wire format
 * `translationKey|jsonParams` (core `kmsg`, the vocabulary
 * `checkFieldValue`/`entityFieldValidator` emit and every surface
 * renders). Without a `|` separator the message is a bare key.
 * ONE decoder — `translated-field-errors.svelte`, dict cells and any
 * future non-formsnap surface all translate identically.
 */
import { extJsonParse } from '@primebrick/core';

export type FieldErrorTranslateFn = (
	key: string,
	params?: Record<string, unknown>,
) => string;

export function translateFieldError(
	error: string,
	t: FieldErrorTranslateFn,
): string {
	if (!error.includes('|')) return t(error);
	const [key, jsonParams] = error.split('|', 2);
	try {
		return t(key, extJsonParse(jsonParams) as Record<string, unknown>);
	} catch {
		// Malformed JSON — fall back to translating the key without params
		return t(key);
	}
}
