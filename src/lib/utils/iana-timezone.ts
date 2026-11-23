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

/**
 * Canonical (CLDR largest-city) zone of a supported BCP-47 region — the
 * curated territory→zone table, `Intl` exposes no locale→zone resolution.
 */
export const REGION_PRIMARY_ZONE: Record<string, string> = {
	GB: 'Europe/London',
	US: 'America/New_York',
	IT: 'Europe/Rome',
	FR: 'Europe/Paris',
	ES: 'Europe/Madrid',
	DE: 'Europe/Berlin',
	PT: 'Europe/Lisbon',
};

/** Region of a BCP-47 tag — `Intl.Locale` handles script tags
 *  (`zh-Hans-CN`→CN); bare `en` resolves undefined. */
function regionOf(tag: string): string | undefined {
	try {
		return new Intl.Locale(tag).region;
	} catch {
		return undefined;
	}
}

/**
 * Picker-ordered IANA list — shared by every zone-picker surface:
 *   1. `UTC` — the canonical default, always the first row
 *   2. the browser's resolved zone (the user's own context)
 *   3. the primary zone of each supported locale's region
 *   4. the rest, sorted
 */
export function getPrioritizedIanaTimeZones(opts?: {
	locales?: readonly string[];
	browser?: string | null;
}): string[] {
	const zones = getIanaTimeZones();
	const first: string[] = [];
	const pin = (tz: string | null | undefined) => {
		if (tz && zones.includes(tz) && !first.includes(tz)) first.push(tz);
	};
	pin('UTC');
	pin(opts?.browser !== undefined ? opts.browser : getResolvedIanaTimeZone());
	for (const tag of opts?.locales ?? []) pin(REGION_PRIMARY_ZONE[regionOf(tag) ?? '']);
	return [...first, ...zones.filter((z) => !first.includes(z))];
}
