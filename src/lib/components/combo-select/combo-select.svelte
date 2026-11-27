<script lang="ts" module>
  /**
   * One popover filter badge — the VISIBLE alternative to hidden prefilters
   * (user-ratified contract 2026-11-26: no combobox filter is ever "applied
   * behind"). `terms` are the match alternatives — OR-ed WITHIN the badge;
   * `label` is the chip text (already translated / meaningful for the user).
   */
  export type ComboFilterBadge = {
    label: string;
    terms: string[];
  };
</script>

<script lang="ts">
  import { cn } from "../../utils/index.js";
  import { getT } from "../../bridges.js";
  import { DEV } from 'esm-env';
  const t = getT();
  import * as Popover from "../popover/index.js";
  import * as Command from "../command/index.js";
  import Badge from "../badge/badge.svelte";
  import { badgeClassesFromToken, colorCssFromToken } from "../../colors/badge.js";
  import { X } from '../../vendor/lucide.js';
  import { Eraser } from '../../vendor/lucide.js';
  import { ChevronDown } from '../../vendor/lucide.js';
  import { Check } from '../../vendor/lucide.js';
  import { EyeDashed } from '../../vendor/lucide.js';
  import { tick, type Snippet } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import { inputTrailingIconColorClasses, inputGhostChromeClasses } from "../input/input-chrome.js";
  import type { TrailingCta } from "../input/text-input.svelte";
  import { menuListSelectedSurfaceDropdownClasses } from "../menu-row-chrome.js";
  import DynamicIcon from "../dynamic-icon/DynamicIcon.svelte";

  type ComboSelectMode = "single" | "multi";
  type MultiBadgeMode = 'icon-label' | 'label' | 'icon';

  /**
   * Multi-mode selected-badge anatomy — opt-in via `multiBadge`:
   *   'icon-label' (default) — resolved icon/flag + label + remove-X;
   *   'label'                — label + remove-X (pre-feature render);
   *   'icon'                 — icon/flag + remove-X only — REQUIRES
   *                            `iconField` or `flagField` at the type level
   *                            (icon-only without an icon source is a
   *                            construction error, not a runtime fallback).
   * An option whose icon/flag resolves null under 'icon' renders its label
   * instead (label is always resolvable) — DEV warns once per value.
   */
  type MultiBadgeProps =
    | {
        /**
         * Option field carrying a Lucide icon name — rendered via `DynamicIcon`
         * before the label in option rows, in the single-mode selected
         * display, and in multi badges per `multiBadge`. Ignored under
         * display='custom' (the snippet owns rendering).
         */
        iconField?: string;
        /** Option field carrying a flag-icons COUNTRY CODE (`gb`, `it`…) —
         *  rendered as `<span class="fi fi-{code}">` in option rows, in the
         *  single-mode selected display, and in multi badges per
         *  `multiBadge`. Requires the host app's `flag-icons` stylesheet
         *  (the `fi`/`fi-{cc}` classes live there). Ignored under
         *  display='custom'. */
        flagField?: string;
        multiBadge?: 'icon-label' | 'label';
      }
    | ({ multiBadge: 'icon' } & (
        | { iconField: string; flagField?: string }
        | { flagField: string; iconField?: string }
      ));

  type CommonProps = {
    mode: ComboSelectMode;
    value: string | string[];
    onChange?: (value: string | string[]) => void;
    options: string[] | Record<string, unknown>[];
    valueField?: string;
    labelField?: string;
    isLabelTranslated?: boolean;
    placeholder?: string;
    disabled?: boolean;
    loading?: boolean;
    id?: string;
    searchable?: boolean;
    searchPlaceholder?: string;
    /**
     * Declarative option template — avoids ad-hoc snippets for common layouts:
     *   'default'  — plain label (default)
     *   'badge'    — option rendered as a colored Badge; reads `colorField`
     *   'detailed' — label + optional `descriptionField` (small italic line)
     *                + `secondaryField` value (mono, muted)
     *   'custom'   — REQUIRED only for itemSnippet (option rows stay on the
     *                canonical template otherwise). selectedSnippet renders
     *                with ANY display — the selected surface is legitimately
     *                variable (badges, avatars).
     */
    display?: 'default' | 'badge' | 'detailed' | 'custom';
    /** display='badge': option field carrying a color token (e.g. 'emerald-500'). Default 'color'. */
    colorField?: string;
    /** display='detailed': option field rendered under the label (mono, muted). Defaults to the resolved value. */
    secondaryField?: string;
    /** display='detailed': option field rendered between label and
     *  secondary — small italic muted line (e.g. a translated description). */
    descriptionField?: string;
    /**
     * Standard option template line toggles (the ICON + bold display name /
     * italic description / tech-name anatomy). All default ON — turning all
     * three off degrades to a classic label-only combobox.
     * `showIcons` also gates the icon in the selected display.
     */
    showIcons?: boolean;
    showDescription?: boolean;
    showTechName?: boolean;
    /** The descriptionField value is an i18n key — translate via $t. */
    isDescriptionTranslated?: boolean;
    /** The secondaryField value is an i18n key — translate via $t. */
    isSecondaryTranslated?: boolean;
    /**
     * Multi-mode collapse threshold — `selectedValues.length > N` swaps
     * the whole badge list for ONE summary chip ("N selected",
     * `app.common.selected_count.one|other` — the plural pair is picked
     * in code, the canonical `.one`/`.other` contract). **Defaults to 1**: two or more
     * selections collapse — stacking badges never inflates the trigger
     * height. Per-value removal stays available in the dropdown; the
     * trailing eraser still clears all. The chip is
     * `variant="destructive"` when any selected value fails
     * `isValueInvalid`. Pass a higher N to keep more badges visible.
     */
    multiSummaryAt?: number;
    /** Option field carrying a color TOKEN (`amber-500` — the badge
     *  vocabulary, resolved to a real CSS color so no safelisted class is
     *  needed); unset → inherits `text-muted-foreground`. */
    iconColorField?: string;
    /** Option field carrying a boolean — when truthy the option icon
     *  renders with dashed strokes (`stroke-dasharray`) instead of solid.
     *  Works on ANY lucide icon, mirroring the lucide `*-dashed` variants
     *  for names that don't ship one (e.g. `mail` has no `mail-dashed`). */
    iconDashedField?: string;
    /** Option field carrying a boolean — when truthy a divider renders
     *  ABOVE that option row (visual group boundary; e.g. promoted
     *  vocabulary vs the alphabetical rest). Follows filtering: the
     *  divider only shows while its row is visible. */
    separatorBeforeField?: string;
    itemSnippet?: Snippet<[{
      option: string | Record<string, unknown>;
      selected: boolean;
      resolvedLabel: string;
      resolvedValue: string;
    }]>;
    isOptionDisabled?: (option: string | Record<string, unknown>) => boolean;
    /**
     * Per-value invalidity — multi mode only. When provided, each selected
     * badge asks the predicate and renders `variant="destructive"` on a
     * truthy answer, so the user sees WHICH entries are invalid (e.g. one
     * bad email among three) instead of a generically red combobox.
     * Declarative, no custom rendering required.
     */
    isValueInvalid?: (value: string) => boolean;
    /**
     * Extra search terms for an option, used both by ComboSelect's own filter
     * and passed to bits-ui's `Command.Item` `keywords` prop to boost scoring.
     * Lets users search by fields not present in `value`/`label` (e.g. permissions, badges).
     */
    getSearchKeywords?: (option: string | Record<string, unknown>) => string[];
    /**
     * Disabled-option visibility toggle — requires `isOptionDisabled`.
     * When ON, disabled options are partitioned OUT of the list by default
     * (only usable options render) and an eye CTA appears after the clear
     * button: activating it reveals the disabled partition as greyed,
     * non-selectable rows that still match the search — so users can
     * discover WHY an expected option is unavailable.
     */
    disabledToggle?: boolean;
    selectedSnippet?: Snippet<[{
      option: string | Record<string, unknown>;
      resolvedLabel: string;
      resolvedValue: string;
    }]>;
    /**
     * When true, shows a "Create '{search}'" item in the dropdown when the
     * search text doesn't match any existing option. Lets users type a new
     * value that isn't in the options list.
     */
    allowCreate?: boolean;
    /**
     * Called when the user creates a new value via the "Create" item.
     * The parent can use this to add the new value to its options array.
     */
    onCreate?: (value: string) => void;
    /**
     * Single-mode anatomy for a created value (not in the options
     * vocabulary): renders the FIELD's icon — synthesized into `iconField`
     * so it rides the same icon pipeline as normal options — plus the
     * label and a muted "New" marker. Badges are the multi-mode anatomy;
     * single selections keep icon+text.
     */
    createdIcon?: string;
    /** `iconColorField` value synthesized for the created value (token like `sky-500`). */
    createdIconColor?: string;
    /**
     * Called whenever the search text changes while the popover is open
     * (fires once with `defaultSearch` on open). Lets the parent drive a
     * remote/async options source — standard ComboSelect stays the same
     * component, only `options` is refilled by the delegate.
     */
    onSearchInput?: (search: string) => void;
    /**
     * Infinite scroll: fired when the user scrolls near the bottom of the
     * options list. The parent appends the next page into `options`.
     * Pair with `loadingMore` to show the trailing spinner row.
     */
    onLoadMore?: () => void;
    /** Shows a spinner row at the bottom of the list while more pages load. */
    loadingMore?: boolean;
    /**
     * Initial search text when the popover opens. Used to pre-filter
     * options (e.g. prefix-filter i18n keys by config.auth.{key}.).
     * The user can clear it via the X button to see all options.
     *
     * CONTRACT with `allowCreate`: any non-empty seeded search produces a
     * "Create '{defaultSearch}'" row that commits the seed VERBATIM when
     * no option exact-matches it. Seed a full selectable value (e.g. the
     * computed `custom.*` suggestion) or a prefix you actually intend to
     * be creatable — never a bare vocabulary prefix, which would offer a
     * garbage key. With `truncateFrom="start"`, a long seed shows only
     * its tail, so a bare prefix reads as a meaningless fragment.
     */
    defaultSearch?: string;
    /**
     * Popover filter badges — IMPOSED vocabulary constraints (meta/app logic,
     * the user cannot remove them): render as muted chips WITHOUT X below the
     * popover search input and AND across badges (within one badge its `terms`
     * OR). Passing this prop (even empty) opts the combobox into the badge
     * engine: Enter commits the typed draft as a removable user badge.
     */
    imposed_filters?: ComboFilterBadge[];
    /**
     * Popover filter badges — PRESET-REMOVABLE vocabulary constraints (sensible
     * defaults the user CAN remove, e.g. the i18n-key family scope): render as
     * chips WITH X and OR among themselves + the user badges + the live draft
     * (the OR-group then ANDs with the imposed set). Removal persists for the
     * component instance lifetime — a fresh mount restores the preset, but
     * nothing ever re-imposes silently mid-session. The popover eraser clears
     * draft + user badges + these presets in one gesture.
     */
    preset_filters?: ComboFilterBadge[];
    /**
     * Trigger trailing zone extras — same contract as TextInput:
     *   `trailing`      — non-CTA content (badges, indicators), left of ctas.
     *   `trailing_ctas` — icon CTAs (`inputTrailingIconColorClasses` chrome),
     *                     left of the clear button; array order = L→R.
     */
    trailing?: Snippet;
    trailing_ctas?: TrailingCta[];
    /**
     * Where the ellipsis goes when the selected value / option text
     * overflows: `'end'` (default, classic `truncate`) or `'start'`
     * (leading `…`, tail stays visible — for long keys whose meaningful
     * part is at the end, e.g. i18n keys). Affects the selected display,
     * the "Create" row, and default/detailed option rows.
     */
    truncateFrom?: 'end' | 'start';
    /**
     * Trigger chrome:
     *   `default` — primary-gradient border on bg-background (forms).
     *   `toolbar` — plain neutral InputGroup-style chrome
     *               (border-foreground/25, transparent bg) for toolbar strips.
     *   `ghost`   — the FORMALIZED ghost chrome: subtle always-visible
     *               `border-foreground/25` on transparent bg (same as the
     *               toolbar SearchBar). Shared via `inputGhostChromeClasses`.
     */
    variant?: "default" | "toolbar" | "ghost";
    class?: string;
    "aria-invalid"?: boolean | "true" | "false";
    "aria-describedby"?: string;
    "aria-required"?: boolean | "true" | "false";
    "data-fs-error"?: string;
    [key: string]: unknown;
  };

  type Props = CommonProps & MultiBadgeProps;

  let {
    mode,
    value = $bindable(),
    onChange,
    options,
    valueField,
    labelField,
    isLabelTranslated = false,
    placeholder = "Select...",
    disabled = false,
    loading = false,
    id,
    searchable = true,
    searchPlaceholder = undefined,
    display = 'default',
    colorField = 'color',
    secondaryField,
    descriptionField,
    showIcons = true,
    showDescription = true,
    showTechName = true,
    isDescriptionTranslated = false,
    isSecondaryTranslated = false,
    iconField,
    iconColorField,
    flagField,
    iconDashedField,
    separatorBeforeField,
    multiBadge = 'icon-label',
    multiSummaryAt = 1,
    itemSnippet,
    isOptionDisabled,
    isValueInvalid,
    getSearchKeywords,
    disabledToggle = false,
    selectedSnippet,
    allowCreate = false,
    onCreate,
    createdIcon,
    createdIconColor,
    onSearchInput,
    onLoadMore,
    loadingMore = false,
    defaultSearch = '',
    imposed_filters,
    preset_filters,
    trailing,
    trailing_ctas,
    truncateFrom = 'end',
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedby,
    "aria-required": ariaRequired,
    "data-fs-error": dataFsError,
    variant = "default",
    class: className,
    "data-testid": dataTestId,
    ...restProps
  }: Props = $props();

  // Contract: itemSnippet renders only in display='custom' (the option-row
  // template is canonical). selectedSnippet is allowed with ANY display —
  // the trigger's selected surface is legitimately variable (created-value
  // badges, avatars) while the item template stays standard.
  $effect(() => {
    if (DEV && itemSnippet && display !== 'custom') {
      console.warn(
        "[ComboSelect] itemSnippet ignored — pass display=\"custom\" to enable snippet rendering.",
      );
    }
  });

  let open = $state(false);
  let search = $state("");
  let listEl = $state<HTMLElement | null>(null);
  let showDisabledOptions = $state(false);

  // Scroll the first selected option into view when the popover opens —
  // long lists should land on the current selection, not the top.
  // NOTE: bits-ui Command.Item owns `aria-selected`/`data-selected`
  // (keyboard highlight), so the real selection is marked with
  // `data-combo-selected` — a non-colliding attribute.
  $effect(() => {
    if (!open) return;
    void tick().then(() => {
      // The popover mounts through a portal — wait one frame so the
      // command list is laid out before measuring/scrolling.
      requestAnimationFrame(() => {
        const sel = listEl?.querySelector("[data-combo-selected]");
        sel?.scrollIntoView({ block: "nearest" });
      });
    });
  });

  // Reset search to defaultSearch whenever the popover opens; the
  // disabled-partition resets on close so each fresh open starts hidden
  // (resetting on open would clobber the reveal-then-open toggle click).
  $effect(() => {
    if (open) {
      search = defaultSearch;
    } else {
      showDisabledOptions = false;
    }
  });

  // Remote-search delegate: notify the parent of every search change
  // while open (including the initial open → prefetch call).
  $effect(() => {
    if (open) {
      onSearchInput?.(search);
    }
  });

  // --- Value & label resolution ---

  function resolveValue(opt: string | Record<string, unknown>): string {
    if (typeof opt === "string") return opt;
    if (valueField) {
      const v = getByPath(opt, valueField);
      return v != null ? String(v) : String(opt);
    }
    return String(opt);
  }

  function resolveLabel(opt: string | Record<string, unknown>): string {
    if (typeof opt === "string") {
      return isLabelTranslated ? $t(opt) : opt;
    }
    if (labelField) {
      const raw = getByPath(opt, labelField);
      if (raw == null) return resolveValue(opt);
      const rawStr = String(raw);
      return isLabelTranslated ? $t(rawStr) : rawStr;
    }
    return resolveValue(opt);
  }

  function resolveIcon(opt: string | Record<string, unknown>): string | null {
    if (!showIcons || !iconField || typeof opt === 'string') return null;
    const raw = getByPath(opt, iconField);
    return raw != null && raw !== '' ? String(raw) : null;
  }

  function resolveIconColor(opt: string | Record<string, unknown>): string | null {
    if (iconColorField && typeof opt !== 'string') {
      const raw = getByPath(opt, iconColorField);
      if (raw != null && raw !== '') return colorCssFromToken(String(raw));
    }
    return null;
  }

  function resolveFlag(opt: string | Record<string, unknown>): string | null {
    if (!showIcons || !flagField || typeof opt === 'string') return null;
    const raw = getByPath(opt, flagField);
    return raw != null && raw !== '' ? String(raw) : null;
  }

  function resolveIconDashed(opt: string | Record<string, unknown>): boolean {
    if (!iconDashedField || typeof opt === 'string') return false;
    return getByPath(opt, iconDashedField) === true;
  }

  function getByPath(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce<unknown>((acc, key) => {
      if (acc && typeof acc === "object" && key in acc) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  // --- Normalized options with resolved value/label ---

  type NormalizedOption = {
    raw: string | Record<string, unknown>;
    value: string;
    label: string;
  };

  let normalizedOptions = $derived.by<NormalizedOption[]>(() => {
    return options.map((opt) => {
      const raw = opt as string | Record<string, unknown>;
      return {
        raw,
        value: resolveValue(raw),
        label: resolveLabel(raw),
      };
    });
  });

  // --- Selection state ---
  // `value` (bindable) is the single source of truth. No duplicate state, no sync
  // effect — a previous internalValue + sync $effect caused effect_update_depth_exceeded
  // for array (multi) values, because two distinct proxies are never ===, so the
  // effect wrote internalValue = value on every run and never converged.

  function syncChange(v: string | string[]) {
    value = v;
    onChange?.(v);
  }

  // --- Single mode helpers ---

  let selectedNormalized = $derived.by<NormalizedOption | null>(() => {
    if (mode !== "single") return null;
    const v = value as string;
    return normalizedOptions.find((o) => o.value === v) ?? null;
  });

  function handleSelectSingle(opt: NormalizedOption) {
    syncChange(opt.value);
    open = false;
    search = "";
    // Selection consumes the search session — user badges reset with the
    // draft (same lifecycle as `search`); preset removals survive so nothing
    // the user explicitly removed comes back behind their back.
    userFilterBadges = [];
  }

  function handleClearSingle() {
    syncChange("");
  }

  // --- Multi mode helpers ---

  let selectedValues = $derived.by<string[]>(() => {
    if (mode !== "multi") return [];
    return Array.isArray(value) ? value : [];
  });

  function handleToggleMulti(opt: NormalizedOption) {
    const current = selectedValues;
    if (current.includes(opt.value)) {
      syncChange(current.filter((v) => v !== opt.value));
    } else {
      syncChange([...current, opt.value]);
    }
  }

  function handleRemoveMulti(val: string) {
    syncChange(selectedValues.filter((v) => v !== val));
  }

  function handleClearMulti() {
    syncChange([]);
  }

  // Summary collapse — `multiSummaryAt` (default 1) swaps the per-value
  // badge list for ONE "N selected" chip (see the prop docs).
  let summaryActive = $derived(
    multiSummaryAt != null && selectedValues.length > multiSummaryAt,
  );

  // 'icon' badges without a resolvable icon/flag fall back to the label —
  // visible degradation (label is always resolvable), never an empty pill.
  // DEV warns once per offending value so sparse icon data is actionable.
  let warnedBadgeNoIcon = new Set<string>();
  $effect(() => {
    if (!DEV || mode !== 'multi' || multiBadge !== 'icon') return;
    for (const v of selectedValues) {
      if (warnedBadgeNoIcon.has(v)) continue;
      const opt = normalizedOptions.find((o) => o.value === v);
      if (opt && !resolveIcon(opt.raw) && !resolveFlag(opt.raw)) {
        warnedBadgeNoIcon.add(v);
        console.warn(
          `[ComboSelect] multiBadge="icon": option "${v}" resolves no icon/flag — badge renders its label.`,
        );
      }
    }
  });

  // --- Popover filter badges (user-ratified 2026-11-26) ---
  // The visible/controlled alternative to hidden prefilters: imposed badges
  // (muted, no X) AND across each other; preset-removable + user badges + the
  // live draft OR among themselves. Opt-in: passing either prop activates the
  // engine — consumers that pass neither keep the legacy plain-search
  // behavior bit-for-bit (a lone draft narrows exactly as before).

  type UserFilterBadge = { id: string; label: string; terms: string[] };
  let userFilterBadges = $state<UserFilterBadge[]>([]);
  /** Keys of preset badges the user removed — removal persists for the
   *  component instance lifetime; a fresh mount restores the preset. */
  const removedPresetKeys = new SvelteSet<string>();

  const filterBadgesEnabled = $derived(imposed_filters !== undefined || preset_filters !== undefined);

  function badgeKey(badge: ComboFilterBadge): string {
    return badge.terms.join(' OR ');
  }

  let activePresetFilters = $derived(
    (preset_filters ?? []).filter((b) => !removedPresetKeys.has(badgeKey(b))),
  );

  /** Enter commits the draft as a user badge — dedupe against existing user
   *  badges (re-committing the same term is a no-op), input empties so the
   *  next OR term can be typed. */
  function commitFilterBadge() {
    const term = search.trim();
    if (!term) return;
    if (!userFilterBadges.some((b) => b.terms.includes(term))) {
      userFilterBadges.push({ id: term, label: term, terms: [term] });
    }
    search = '';
  }

  function removeUserFilterBadge(badge: UserFilterBadge) {
    userFilterBadges = userFilterBadges.filter((b) => b.id !== badge.id);
  }

  function removePresetFilterBadge(badge: ComboFilterBadge) {
    removedPresetKeys.add(badgeKey(badge));
  }

  /** Eraser contract: one click clears the draft (the input itself) plus
   *  every removable badge — user AND preset; imposed badges are immutable
   *  by definition. */
  let removableBadgesExist = $derived(userFilterBadges.length > 0 || activePresetFilters.length > 0);
  function clearRemovableFilterBadges() {
    userFilterBadges = [];
    for (const b of preset_filters ?? []) removedPresetKeys.add(badgeKey(b));
  }

  function optMatchesTerm(opt: NormalizedOption, term: string): boolean {
    const lower = term.toLowerCase();
    if (opt.label.toLowerCase().includes(lower)) return true;
    if (opt.value.toLowerCase().includes(lower)) return true;
    const kws = getSearchKeywords?.(opt.raw) ?? [];
    return kws.some((k) => k.toLowerCase().includes(lower));
  }

  // --- Filtering ---

  let filteredOptions = $derived.by<NormalizedOption[]>(() => {
    if (!filterBadgesEnabled) {
      // Legacy path — plain single-term substring narrowing, byte-identical
      // to the pre-badge behavior.
      if (!search) return normalizedOptions;
      return normalizedOptions.filter((opt) => optMatchesTerm(opt, search));
    }
    const imposed = imposed_filters ?? [];
    const orTerms = [...activePresetFilters, ...userFilterBadges].flatMap((b) => b.terms);
    const draft = search.trim();
    if (draft) orTerms.push(draft);
    return normalizedOptions.filter((opt) => {
      for (const badge of imposed) {
        if (!badge.terms.some((term) => optMatchesTerm(opt, term))) return false;
      }
      if (orTerms.length > 0 && !orTerms.some((term) => optMatchesTerm(opt, term))) return false;
      return true;
    });
  });

  // `disabledToggle` partition — disabled options are hidden by default and
  // revealed (greyed, still non-selectable, still matching the search) by
  // the eye CTA. Without the toggle every option renders, disabled included
  // (the pre-existing semantics).
  let visibleOptions = $derived.by<NormalizedOption[]>(() => {
    if (!disabledToggle || !isOptionDisabled || showDisabledOptions) return filteredOptions;
    return filteredOptions.filter((opt) => !isOptionDisabled(opt.raw));
  });

  // --- Render window (user-ratified 2026-11-26) ---
  // A combobox is a SEARCH-FIRST control: mounting every matching row
  // synchronously blocks the popover open for SECONDS on large vocabularies
  // (measured 1.8s on the 3k-key `.entities.` i18n vocabulary — zero network
  // involved, pure DOM mount). The initial window mounts instantly; scrolling
  // near the bottom grows it progressively (client-side infinite scroll), a
  // muted trailing row tells how much is still hidden, and narrowing by
  // search re-windows on the reduced set. Server-paged consumers compose
  // freely: `onLoadMore` fires only once the local window is exhausted.
  const INITIAL_RENDER_LIMIT = 50;
  const RENDER_CHUNK = 50;
  let renderLimit = $state(INITIAL_RENDER_LIMIT);
  // Re-window on search keystrokes / popover reopen — a fresh filter must
  // not inherit a deep-scroll limit (it would re-mount hundreds of rows on
  // every keystroke). NEVER on options identity: server page appends replace
  // the array, and resetting there would collapse the scrolled window.
  $effect(() => {
    search;
    open;
    userFilterBadges.length;
    removedPresetKeys.size;
    renderLimit = INITIAL_RENDER_LIMIT;
  });
  let renderedOptions = $derived(visibleOptions.slice(0, renderLimit));
  let truncatedCount = $derived(Math.max(0, visibleOptions.length - renderedOptions.length));

  // --- Create mode ---

  // Show "Create" item when allowCreate is on, search is non-empty, and no
  // existing option matches the search text exactly (by value or label).
  let exactMatchExists = $derived.by(() => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return normalizedOptions.some(
      (o) => o.value.toLowerCase() === s || o.label.toLowerCase() === s,
    );
  });

  let showCreateItem = $derived(allowCreate && search.trim() !== '' && !exactMatchExists);

  // Infinite scroll — near-bottom hit first grows the client render window
  // (progressive disclosure of the already-loaded vocabulary); the parent's
  // server next-page delegate fires only once that window is exhausted —
  // never prefetching pages the user hasn't scrolled into.
  function handleListScroll(e: Event) {
    const el = e.currentTarget as HTMLElement;
    if (el.scrollHeight - el.scrollTop - el.clientHeight >= 48) return;
    if (truncatedCount > 0) {
      renderLimit += RENDER_CHUNK;
      return;
    }
    if (onLoadMore && !loadingMore) onLoadMore();
  }

  function handleCreate() {
    const newKey = search.trim();
    if (!newKey) return;
    if (mode === 'single') {
      syncChange(newKey);
      open = false;
      search = '';
    } else {
      if (!selectedValues.includes(newKey)) {
        syncChange([...selectedValues, newKey]);
      }
      // Same contract as single mode: the created value is committed, the
      // query is consumed — the input must be empty for the next entry.
      search = '';
    }
    onCreate?.(newKey);
  }
</script>

<Popover.Root
  open={open && !disabled}
  onOpenChange={(v) => {
    if (disabled) return;
    open = v;
  }}
>
  <Popover.Trigger>
    {#snippet child({ props: triggerProps })}
      <div
        {...triggerProps}
        {id}
        role="combobox"
        tabindex={disabled ? -1 : 0}
        data-animated-border
        class={cn(
          "relative min-h-9 w-full rounded-md px-3 py-1 text-sm ring-offset-background outline-hidden transition-all",
          variant === "toolbar"
            ? "border border-foreground/25 bg-transparent hover:border-foreground/40 focus-within:border-foreground/50"
            : variant === "ghost"
              ? inputGhostChromeClasses
              : "border-primary-gradient bg-background hover:brightness-105",
          "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          disabled
            ? "pointer-events-none cursor-not-allowed border-disabled"
            : "cursor-pointer",
          "flex items-center gap-2 text-left",
          "aria-invalid:border-destructive-gradient aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          className
        )}
        aria-disabled={disabled || undefined}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedby}
        aria-required={ariaRequired}
        data-fs-error={dataFsError}
        data-testid={dataTestId}
      >
        {#if mode === "single"}
          {#if selectedNormalized}
            {#if selectedSnippet}
              {@render selectedSnippet({
                option: selectedNormalized.raw,
                resolvedLabel: selectedNormalized.label,
                resolvedValue: selectedNormalized.value,
              })}
            {:else if display === 'badge'}
              {@const c = badgeClassesFromToken(getByPath(selectedNormalized.raw as Record<string, unknown>, colorField) as string ?? null)}
              <Badge class="shadow-none" style="background-color:{c.bgColor};color:{c.textColor};border-color:{c.borderColor};">
                {selectedNormalized.label}
              </Badge>
            {:else}
              {@const selIcon = resolveIcon(selectedNormalized.raw)}
              {@const selFlag = resolveFlag(selectedNormalized.raw)}
              {#if selIcon}
                {@const selIconColor = resolveIconColor(selectedNormalized.raw)}
                <DynamicIcon
                  name={selIcon}
                  size={16}
                  class={cn(
                    "shrink-0",
                    !selIconColor && "text-muted-foreground",
                    resolveIconDashed(selectedNormalized.raw) && "[&_path]:[stroke-dasharray:3_1.5]",
                  )}
                  style={selIconColor ? `color:${selIconColor}` : undefined}
                />
              {:else if selFlag}
                <span class={`fi fi-${selFlag} shrink-0 rounded-sm`} aria-hidden="true"></span>
              {/if}
              <span class={cn("flex-1 text-left", truncateFrom === 'start' ? 'truncate-start' : 'truncate')}>
                {selectedNormalized.label}
              </span>
            {/if}
          {:else if (value as string).trim() !== ''}
            <!-- Created value not in options list — render with "new" badge -->
            {#if selectedSnippet}
              {@render selectedSnippet({
                option: { [valueField ?? 'value']: value } as Record<string, unknown>,
                resolvedLabel: value as string,
                resolvedValue: value as string,
              })}
            {:else}
              <!-- Created value — SINGLE anatomy mirrors a normal
                   selection (icon + text), never a Badge: badges are the
                   multi-mode surface. `createdIcon`/`createdIconColor` are
                   synthesized into iconField so the value rides the same
                   icon pipeline as vocabulary options; the muted "New"
                   suffix marks it as outside the vocabulary — same marker
                   as multi-mode created badges. -->
              {@const createdRaw = {
                [valueField ?? 'value']: value,
                ...(iconField && createdIcon ? { [iconField]: createdIcon } : {}),
                ...(iconColorField && createdIconColor ? { [iconColorField]: createdIconColor } : {}),
              }}
              {@const createdIconResolved = resolveIcon(createdRaw)}
              {#if createdIconResolved}
                {@const createdIconColorResolved = resolveIconColor(createdRaw)}
                <DynamicIcon
                  name={createdIconResolved}
                  size={16}
                  class={cn("shrink-0", !createdIconColorResolved && "text-muted-foreground")}
                  style={createdIconColorResolved ? `color:${createdIconColorResolved}` : undefined}
                />
              {/if}
              <span class={cn("flex-1 min-w-0 text-left", truncateFrom === 'start' ? 'truncate-start' : 'truncate')}>
                {value as string}
              </span>
              <span class="shrink-0 text-[10px] font-normal opacity-60">{$t('app.common.new')}</span>
            {/if}
          {:else}
            <span class="flex-1 truncate text-left text-muted-foreground">
              {placeholder}
            </span>
          {/if}
        {:else}
          {#if selectedValues.length === 0}
            <span class="flex-1 truncate text-left text-muted-foreground">
              {placeholder}
            </span>
          {:else}
            <div class="flex flex-1 flex-wrap gap-2 items-center text-left">
              {#if summaryActive}
                {@const anyInvalid = selectedValues.some((v) => isValueInvalid?.(v) ?? false)}
                <Badge variant={anyInvalid ? 'destructive' : 'secondary'} class={cn("gap-1", disabled && "bg-background")} data-invalid={anyInvalid || undefined}>
                  {$t(
                    selectedValues.length === 1
                      ? 'app.common.selected_count.one'
                      : 'app.common.selected_count.other',
                    { count: selectedValues.length },
                  )}
                </Badge>
              {:else}
                {#each selectedValues as val (val)}
                  {@const opt = normalizedOptions.find((o) => o.value === val)}
                  {@const invalid = isValueInvalid?.(val) ?? false}
                  {@const optIcon = opt ? resolveIcon(opt.raw) : null}
                  {@const optFlag = opt ? resolveFlag(opt.raw) : null}
                  {@const showGlyph = multiBadge !== 'label' && (optIcon != null || optFlag != null)}
                  {@const showLabel = multiBadge !== 'icon' || !showGlyph}
                  <Badge variant={invalid ? 'destructive' : 'secondary'} class={cn("gap-1", disabled && "bg-background")} data-invalid={invalid || undefined}>
                    {#if showGlyph}
                      {#if optIcon}
                        {@const optIconColor = opt ? resolveIconColor(opt.raw) : null}
                        <DynamicIcon
                          name={optIcon}
                          size={12}
                          class="shrink-0"
                          style={optIconColor ? `color:${optIconColor}` : undefined}
                        />
                      {:else if optFlag}
                        <span class={`fi fi-${optFlag} shrink-0 rounded-sm`} aria-hidden="true"></span>
                      {/if}
                    {/if}
                    {#if showLabel}
                      {opt?.label ?? val}
                    {/if}
                    {#if !opt}
                      <span class="text-[10px] opacity-60">{$t('app.common.new')}</span>
                    {/if}
                    {#if !disabled}
                      <button
                        type="button"
                        onpointerdown={(e) => e.stopPropagation()}
                        onclick={(e) => {
                          e.stopPropagation();
                          handleRemoveMulti(val);
                        }}
                        class="rounded-full hover:bg-muted hover:text-foreground p-0.5"
                      >
                        <X class="h-3 w-3" />
                      </button>
                    {/if}
                  </Badge>
                {/each}
              {/if}
            </div>
          {/if}
        {/if}
        <div class="ml-auto flex items-center gap-1 shrink-0">
          {#if trailing}
            {@render trailing()}
          {/if}
          {#each trailing_ctas ?? [] as cta (cta.label)}
            <button
              type="button"
              onpointerdown={(e) => e.stopPropagation()}
              onclick={(e) => { e.stopPropagation(); cta.onclick(); }}
              class={inputTrailingIconColorClasses}
              aria-label={cta.label}
              title={cta.label}
              disabled={cta.disabled}
              data-testid={cta["data-testid"]}
            >
              <DynamicIcon name={cta.icon} size={16} />
            </button>
          {/each}
          {#if mode === "single" && !disabled}
            <button
              type="button"
              onpointerdown={(e) => e.stopPropagation()}
              onclick={(e) => { e.stopPropagation(); handleClearSingle(); }}
              class={inputTrailingIconColorClasses}
              aria-label={$t("app.common.clear_selection")}
              title={$t("app.common.clear_selection")}
              disabled={!value}
            >
              <Eraser />
            </button>
          {/if}
          {#if mode === "multi" && !disabled}
            <button
              type="button"
              onpointerdown={(e) => e.stopPropagation()}
              onclick={(e) => { e.stopPropagation(); handleClearMulti(); }}
              class={inputTrailingIconColorClasses}
              aria-label={$t("app.common.clear_selection")}
              title={$t("app.common.clear_selection")}
              disabled={selectedValues.length === 0}
            >
              <Eraser />
            </button>
          {/if}
          {#if loading}
            <div class="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
          {:else}
            <ChevronDown class="h-4 w-4 text-muted-foreground" />
          {/if}
        </div>
      </div>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content align="start" class="w-(--bits-popover-anchor-width) min-w-56 p-0">
    {#if loading}
      <!-- Fetch-in-flight strip — flush to the popover's top edge like its
           top border (zero gap, user-ratified 2026-11-26): the SAME animated
           primary-gradient scan the ELT reload strip renders, self-contained
           here so no consumer CSS is needed. -->
      <div class="cb-loading-strip" aria-hidden="true">
        <div class="cb-loading-underlay"></div>
        <div class="cb-loading-comet"></div>
      </div>
    {/if}
    <!-- shouldFilter=false: filtering is owned by `filteredOptions` (label +
         value + getSearchKeywords). bits-ui's internal filter only matches the
         item `value` (+ keywords), which breaks searches by label — e.g. typing
         "dollar" found nothing because the item value is "USD". -->
    <Command.Root shouldFilter={false}>
      {#if searchable}
        <Command.Input
          bind:value={search}
          placeholder={searchPlaceholder ?? $t('app.search.placeholder')}
          clear_enabled={removableBadgesExist}
          on_clear={clearRemovableFilterBadges}
          onkeydown={(e) => {
            if (e.key === 'Enter' && showCreateItem) {
              e.preventDefault();
              handleCreate();
            } else if (e.key === 'Enter' && filterBadgesEnabled && search.trim()) {
              // Enter commits the draft as a user badge — the OR-accumulation
              // gesture. The input empties, so a follow-up Enter with an empty
              // draft falls through to bits-ui's native row selection.
              // stopPropagation: bits-ui's root-level Enter handler must never
              // row-select on the same keystroke — a selection would consume
              // the search session and wipe the badge just committed.
              e.preventDefault();
              e.stopPropagation();
              commitFilterBadge();
            }
          }}
        >
          {#snippet trailing()}
            {#if disabledToggle && isOptionDisabled && !disabled}
              <!-- Partition toggle — `eye-dashed`: reveals the disabled
                   partition (hidden data, NOT secrets — `eye`/`eye-off`
                   are the secret pair). One glyph, state by color +
                   aria-pressed: muted = hidden, foreground = shown. -->
              <button
                type="button"
                onclick={(e) => {
                  e.stopPropagation();
                  showDisabledOptions = !showDisabledOptions;
                }}
                class={cn(inputTrailingIconColorClasses, showDisabledOptions && "text-foreground")}
                aria-label={$t(showDisabledOptions ? "app.common.hide_disabled_options" : "app.common.show_disabled_options")}
                title={$t(showDisabledOptions ? "app.common.hide_disabled_options" : "app.common.show_disabled_options")}
                aria-pressed={showDisabledOptions}
                data-testid={dataTestId ? `${dataTestId}-toggle-disabled` : undefined}
              >
                <EyeDashed />
              </button>
            {/if}
          {/snippet}
        </Command.Input>
      {/if}
      {#if filterBadgesEnabled && (imposed_filters?.length || activePresetFilters.length || userFilterBadges.length)}
        <!-- Applied-filter strip — the ratified visibility contract: every
             filter acting on this list is a chip the user can see; imposed
             ones are muted and sealed (no X), preset/user ones carry the
             remove X. Nothing is ever applied behind. -->
        <div class="flex flex-wrap items-center gap-1 px-1 pb-1.5" data-testid="combo-filter-badges">
          {#each imposed_filters ?? [] as badge (badgeKey(badge))}
            <Badge
              variant="outline"
              class="gap-1 text-muted-foreground opacity-80"
              data-testid="combo-filter-badge"
              data-kind="imposed"
              data-term={badgeKey(badge)}
            >
              <span class="text-xs">{badge.label}</span>
            </Badge>
          {/each}
          {#each activePresetFilters as badge (badgeKey(badge))}
            <Badge
              variant="secondary"
              class="gap-1 pr-1"
              data-testid="combo-filter-badge"
              data-kind="preset"
              data-term={badgeKey(badge)}
            >
              <span class="text-xs italic">{badge.label}</span>
              <button
                type="button"
                class="ml-0.5 inline-flex size-4 cursor-pointer items-center justify-center rounded-full hover:bg-muted-foreground/20"
                onclick={() => removePresetFilterBadge(badge)}
                aria-label={$t('app.common.remove')}
                data-testid="combo-filter-badge-remove"
                data-term={badgeKey(badge)}
              >
                <X class="size-3" />
              </button>
            </Badge>
          {/each}
          {#each userFilterBadges as badge (badge.id)}
            <Badge
              variant="secondary"
              class="gap-1 pr-1"
              data-testid="combo-filter-badge"
              data-kind="user"
              data-term={badgeKey(badge)}
            >
              <span class="text-xs">{badge.label}</span>
              <button
                type="button"
                class="ml-0.5 inline-flex size-4 cursor-pointer items-center justify-center rounded-full hover:bg-muted-foreground/20"
                onclick={() => removeUserFilterBadge(badge)}
                aria-label={$t('app.common.remove')}
                data-testid="combo-filter-badge-remove"
                data-term={badgeKey(badge)}
              >
                <X class="size-3" />
              </button>
            </Badge>
          {/each}
        </div>
      {/if}
      <Command.List bind:ref={listEl} onscroll={handleListScroll}>
        {#if showCreateItem}
          <Command.Item
            value={search.trim()}
            keywords={[search.trim()]}
            class={cn(
              "relative flex w-full cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden",
              "data-highlighted:bg-muted data-highlighted:text-foreground",
              "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
              "[&_.cn-command-item-indicator]:hidden",
            )}
            onSelect={() => handleCreate()}
          >
            <div class="flex items-center gap-2 w-full">
              {#if mode === "multi"}
                <!-- Unchecked chrome mirrors the canonical Checkbox:
                     border-input + bg-background, rounded-[4px]. -->
                <div class="combo-select-checkbox h-4 w-4 rounded-[4px] border border-input bg-background shadow-xs shrink-0"></div>
              {/if}
              {#if truncateFrom === 'start'}
                <span class="flex min-w-0 flex-1 items-baseline whitespace-nowrap text-left">
                  <span class="shrink-0">{$t('app.common.create')} "</span><span class="font-medium truncate-start min-w-0 flex-1">{search.trim()}</span><span class="shrink-0">"</span>
                </span>
              {:else}
                <span class="flex-1 truncate text-left">
                  {$t('app.common.create')} <span class="font-medium">"{search.trim()}"</span>
                </span>
              {/if}
            </div>
          </Command.Item>
        {/if}
        {#if visibleOptions.length === 0 && !showCreateItem}
          {#if loading}
            <!-- Async fetch in flight — the popover opens IMMEDIATELY with
                 a muted loading line instead of the false "no results"
                 (user-ratified 2026-11-26). -->
            <div class="py-6 text-center text-sm text-muted-foreground" data-testid={dataTestId ? `${dataTestId}-loading` : undefined}>
              {$t('app.common.loading_data')}
            </div>
          {:else}
            <Command.Empty>{$t('app.common.no_results')}</Command.Empty>
          {/if}
        {:else if visibleOptions.length > 0}
          {#each renderedOptions as opt (opt.value)}
            {@const isDisabled = isOptionDisabled ? isOptionDisabled(opt.raw) : false}
            {@const isSelected = mode === "single" ? (value as string) === opt.value : selectedValues.includes(opt.value)}
            {#if separatorBeforeField && (opt.raw as Record<string, unknown>)[separatorBeforeField]}
              <div class="mx-1 my-1 h-px bg-border" role="separator"></div>
            {/if}
            <Command.Item
              value={opt.value}
              keywords={getSearchKeywords ? getSearchKeywords(opt.raw) : undefined}
              disabled={isDisabled}
              data-combo-selected={isSelected || undefined}
              class={cn(
                "relative flex w-full cursor-default select-none items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm outline-hidden",
                "data-highlighted:bg-muted data-highlighted:text-foreground",
                "data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-60 data-disabled:text-muted-foreground data-disabled:data-highlighted:bg-transparent",
                "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                // command-item appends a check indicator (ml-auto opacity-0,
                // never data-checked here) → dead space on the right; hide it
                // so trailing content (e.g. RankMeter) stays flush right.
                "[&_.cn-command-item-indicator]:hidden",
                isSelected && menuListSelectedSurfaceDropdownClasses,
              )}
              onSelect={() => {
                if (isDisabled) return;
                if (mode === "single") {
                  handleSelectSingle(opt);
                } else {
                  handleToggleMulti(opt);
                }
              }}
            >
              <div class="flex items-center gap-2 w-full">
                {#if mode === "multi"}
                  <!-- Checkbox chrome mirrors the canonical Checkbox tone
                       "primary": unchecked border-input + bg-background;
                       checked sky→indigo gradient, white check, borderless. -->
                  <div class={cn(
                    "combo-select-checkbox h-4 w-4 rounded-[4px] border shadow-xs shrink-0 flex items-center justify-center",
                    selectedValues.includes(opt.value)
                      ? "bg-linear-to-br from-sky-400 to-indigo-400 text-white border-transparent"
                      : "border-input bg-background",
                  )}>
                    {#if selectedValues.includes(opt.value)}
                      <Check class="size-3.5" />
                    {/if}
                  </div>
                {/if}
                {#if display === 'custom' && itemSnippet}
                  {@render itemSnippet({
                    option: opt.raw,
                    selected: mode === "multi" ? selectedValues.includes(opt.value) : (value as string) === opt.value,
                    resolvedLabel: opt.label,
                    resolvedValue: opt.value,
                  })}
                {:else}
                  {@const optIcon = resolveIcon(opt.raw)}
                  {@const optFlag = resolveFlag(opt.raw)}
                  {#if optIcon}
                    {@const optIconColor = resolveIconColor(opt.raw)}
                    <DynamicIcon
                      name={optIcon}
                      size={16}
                      class={cn(
                        "shrink-0",
                        display === 'detailed' && "self-start mt-0.5",
                        !optIconColor && "text-muted-foreground",
                        resolveIconDashed(opt.raw) && "[&_path]:[stroke-dasharray:3_1.5]",
                      )}
                      style={optIconColor ? `color:${optIconColor}` : undefined}
                    />
                  {:else if optFlag}
                    <span class={cn(`fi fi-${optFlag} shrink-0 rounded-sm`, display === 'detailed' && "self-start mt-1")} aria-hidden="true"></span>
                  {/if}
                  {#if display === 'badge'}
                    {@const c = badgeClassesFromToken(getByPath(opt.raw as Record<string, unknown>, colorField) as string ?? null)}
                    <Badge class="shadow-none" style="background-color:{c.bgColor};color:{c.textColor};border-color:{c.borderColor};">
                      {opt.label}
                    </Badge>
                  {:else if display === 'detailed'}
                    {@const descRaw = showDescription && descriptionField ? getByPath(opt.raw as Record<string, unknown>, descriptionField) : null}
                    {@const hasDesc = descRaw != null && descRaw !== ''}
                    <!-- Bold label only when a secondary row renders —
                         everything off degrades to the classic plain label. -->
                    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span class={cn((hasDesc || showTechName) && "font-medium", truncateFrom === 'start' ? 'truncate-start' : 'truncate')}>{opt.label}</span>
                      {#if hasDesc}
                        <span class={cn("text-xs italic text-muted-foreground", truncateFrom === 'start' ? 'truncate-start' : 'truncate')}>
                          {isDescriptionTranslated ? $t(String(descRaw)) : String(descRaw)}
                        </span>
                      {/if}
                      {#if showTechName}
                        {@const techRaw = secondaryField ? (getByPath(opt.raw as Record<string, unknown>, secondaryField) ?? opt.value) : opt.value}
                        <span class={cn("font-mono text-xs text-muted-foreground", truncateFrom === 'start' ? 'truncate-start' : 'truncate')}>
                          {isSecondaryTranslated ? $t(String(techRaw)) : String(techRaw)}
                        </span>
                      {/if}
                    </div>
                  {:else}
                    <span class={cn("flex-1 text-left", truncateFrom === 'start' ? 'truncate-start' : 'truncate')}>{opt.label}</span>
                  {/if}
                {/if}
              </div>
            </Command.Item>
          {/each}
        {/if}
        {#if truncatedCount > 0}
          <!-- Render-window truncation hint — the list did NOT end: scrolling
               reveals the next chunk, typing narrows the vocabulary. -->
          <div
            class="cb-truncation-hint py-2 text-center text-xs text-muted-foreground select-none"
            data-testid={dataTestId ? `${dataTestId}-more` : undefined}
          >
            {$t(truncatedCount === 1 ? 'app.common.combo_more_items.one' : 'app.common.combo_more_items.other', { count: truncatedCount })}
          </div>
        {/if}
        {#if loadingMore}
          <div class="flex items-center justify-center py-2" aria-hidden="true">
            <div class="size-4 animate-spin rounded-full border-2 border-muted border-t-foreground"></div>
          </div>
        {/if}
      </Command.List>
    </Command.Root>
  </Popover.Content>
</Popover.Root>

<style>
  /* Fetch-in-flight strip — the ELT reload scan, self-contained: squared
     track flush to the popover's top edge (its visual top border), dim
     brand-gradient underlay + the ping-pong comet. */
  .cb-loading-strip {
    position: relative;
    height: 2px;
    width: 100%;
    overflow: hidden;
    border-radius: var(--radius-md, 6px) var(--radius-md, 6px) 0 0;
    background: color-mix(in oklab, var(--muted) 60%, transparent);
  }
  .cb-loading-underlay {
    position: absolute;
    inset: 0;
    opacity: 0.15;
    background-image: linear-gradient(to right, #38bdf8, #6366f1, #8b5cf6, #6366f1, #38bdf8);
    background-size: 200% 100%;
    animation: cb-gradient-pan 3s linear infinite;
  }
  .cb-loading-comet {
    position: absolute;
    inset-block: 0;
    left: 0;
    width: 25%;
    border-radius: 9999px;
    background: linear-gradient(
      to right,
      transparent 0%,
      #38bdf8 35%,
      #6366f1 50%,
      #8b5cf6 65%,
      transparent 100%
    );
    box-shadow: 0 0 6px 1px rgba(99, 102, 241, 0.9);
    animation: cb-kitt-scan 0.85s cubic-bezier(0.45, 0, 0.55, 1) infinite alternate;
  }
  @keyframes cb-kitt-scan {
    from { transform: translateX(0%); }
    to   { transform: translateX(300%); }
  }
  @keyframes cb-gradient-pan {
    from { background-position: 0% 0; }
    to   { background-position: 200% 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .cb-loading-underlay,
    .cb-loading-comet {
      animation: none;
    }
    .cb-loading-comet {
      width: 100%;
      box-shadow: none;
    }
  }
</style>
