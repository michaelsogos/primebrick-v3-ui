/**
 * IANA time zone from the environment's default `Intl.DateTimeFormat` (e.g. `Europe/Rome`).
 * In the browser this reflects the user's system time zone. Call from client-only UI after mount
 * if you must avoid SSR/server defaults.
 */
export function getResolvedIanaTimeZone(): string | null {
	try {
		const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone;
		return typeof tz === 'string' && tz.length > 0 ? tz : null;
	} catch {
		return null;
	}
}

/**
 * The sorted IANA time-zone list — `Intl.supportedValuesOf("timeZone")` where
 * available, with a static fallback of common zones otherwise. "UTC" is
 * always guaranteed present: some engines' ICU coverage omits it from
 * `supportedValuesOf` (verified: Chromium 418-zone list lacks it while
 * others include it), and a zone picker whose canonical default isn't a
 * selectable option is broken by definition. Single source for every
 * zone-picker surface (date dropper's zone selector, the
 * `options_source:"iana.tzones"` form/filter combobox).
 */
export function getIanaTimeZones(): string[] {
	try {
		const zones = Intl.supportedValuesOf('timeZone');
		return zones.includes('UTC') ? zones.sort() : [...zones, 'UTC'].sort();
	} catch {
		return [
			'UTC',
			'Europe/Rome',
			'Europe/London',
			'Europe/Paris',
			'Europe/Berlin',
			'Europe/Madrid',
			'America/New_York',
			'America/Los_Angeles',
			'America/Chicago',
			'Asia/Tokyo',
			'Asia/Shanghai',
			'Asia/Dubai',
			'Australia/Sydney',
			'Australia/Melbourne',
		];
	}
}
