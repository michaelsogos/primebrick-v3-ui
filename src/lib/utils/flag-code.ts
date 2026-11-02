/**
 * BCP-47 tag → flag-icons country code (`it-IT` → `it`, `en-GB` → `gb`,
 * `en` → `gb`? no — regionless tags return `null`, never a guessed flag).
 * Pure derivation from the tag's REGION subtag: the caller renders
 * `<span class="fi fi-{code}">` — no mapping table, no hardcoded locales.
 * The canonical shared point for flag rendering (ComboSelect `flagField`,
 * LangSelect, payload_map locale options).
 */
export function flagCodeForBcp47(tag: string): string | null {
  // Skip the language subtag; the first subtag of length 2 is the region
  // (script subtags are 4 letters — e.g. `zh-Hant-TW` → `tw`).
  for (const part of tag.split('-').slice(1)) {
    if (/^[a-zA-Z]{2}$/.test(part)) return part.toLowerCase();
  }
  return null;
}
