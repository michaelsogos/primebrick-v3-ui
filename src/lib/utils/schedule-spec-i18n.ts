/**
 * schedule-spec-i18n — the LOCALIZED rendering half of `parse-schedule-spec`.
 *
 * `parse-schedule-spec` returns structured/parse results; this module turns
 * them into user-facing text through the host i18n bridge. Shared by the
 * schedule-spec input (editor preview) and the `ScheduleSpecCell` list
 * renderer — one formatter, zero duplicated prose.
 */
import type { TranslateFn } from '../bridges.js';
import { formatUiDateTime, formatUiDateTimeInTimeZone } from './format-date.js';
import { getResolvedIanaTimeZone } from './iana-timezone.js';
import type { ScheduleDescription } from './parse-schedule-spec.js';

/** Fire instants render in the app's resolved zone (same source the top bar
 *  reads), not the browser default. */
export function scheduleRunLabel(d: Date, locale: string): string {
	const appTz = getResolvedIanaTimeZone();
	return appTz ? formatUiDateTimeInTimeZone(d, locale, appTz) : formatUiDateTime(d, locale);
}

/** Structured descriptor → localized phrase (i18n keys, plural-aware units). */
export function scheduleDescriptionText(
	d: ScheduleDescription,
	t: TranslateFn,
	locale: string,
): string {
	if (d.kind === 'text') return d.text;
	if (d.kind === 'at') {
		return t('app.widgets.schedule_spec.desc.at', { date: scheduleRunLabel(d.at, locale) });
	}
	return t('app.widgets.schedule_spec.desc.every', {
		n: d.n,
		unit: t(`app.widgets.schedule_spec.unit.${d.unit}.${d.n === 1 ? 'one' : 'other'}`),
	});
}
