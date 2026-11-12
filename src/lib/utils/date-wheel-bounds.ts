/**
 * Lower-bound refusal for the wheel pickers.
 *
 * `DateWheelPicker`'s `minValue` is an absolute instant (`Date`). The
 * refusal compares what a wheel selection would COMMIT against it:
 *
 *   - `CalendarDateTime` candidate (includeTime) → the wheels are a wall
 *     clock in the picker's selected zone, so the comparison resolves the
 *     candidate to an instant in `zone` and compares milliseconds.
 *   - `CalendarDate` candidate (date-only) → there is no zone in play;
 *     the comparison is calendar days in the wheels' local zone, which is
 *     also where `minValue`'s day is read.
 *   - `minValue` absent → never below min.
 */
import { CalendarDate, CalendarDateTime, getLocalTimeZone } from '@internationalized/date';

export function isWheelSelectionBelowMin(
	candidate: CalendarDate | CalendarDateTime,
	minValue: Date | null | undefined,
	zone?: string,
): boolean {
	if (!minValue) return false;
	if (candidate instanceof CalendarDateTime) {
		const tz = zone || getLocalTimeZone();
		return candidate.toDate(tz).getTime() < minValue.getTime();
	}
	const minDay = new CalendarDate(
		minValue.getFullYear(),
		minValue.getMonth() + 1,
		minValue.getDate(),
	);
	return candidate.compare(minDay) < 0;
}
