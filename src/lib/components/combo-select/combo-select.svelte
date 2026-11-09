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
  import { inputTrailingIconColorClasses, inputGhostChromeClasses } from "../input/input-chrome.js";
  import type { TrailingCta } from "../input/text-input.svelte";
  import { menuListSelectedSurfaceDropdownClasses } from "../menu-row-chrome.js";
  import DynamicIcon from "../dynamic-icon/DynamicIcon.svelte";

  type ComboSelectMode = "single" | "multi";

  type Props = {
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
     * Option field carrying a Lucide icon name — rendered via `DynamicIcon`
     * before the label in option rows AND in the single-mode selected
     * display. Ignored under display='custom' (the snippet owns rendering).
     */
    iconField?: string;
    /** Option field carrying a color TOKEN (`amber-500` — the badge
     *  vocabulary, resolved to a real CSS color so no safelisted class is
     *  needed); unset → inherits `text-muted-foreground`. */
    iconColorField?: string;
    /** Option field carrying a flag-icons COUNTRY CODE (`gb`, `it`…) —
     *  rendered as `<span class="fi fi-{code}">` before the label in option
     *  rows AND in the single-mode selected display. Requires the host app's
     *  `flag-icons` stylesheet (the `fi`/`fi-{cc}` classes live there).
     *  Ignored under display='custom'. */
    flagField?: string;
    /** Option field carrying a boolean — when truthy the option icon
     *  renders with dashed strokes (`stroke-dasharray`) instead of solid.
     *  Works on ANY lucide icon, mirroring the lucide `*-dashed` variants
     *  for names that don't ship one (e.g. `mail` has no `mail-dashed`). */
    iconDashedField?: string;
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
     */
    defaultSearch?: string;
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
    itemSnippet,
    isOptionDisabled,
    isValueInvalid,
    getSearchKeywords,
    disabledToggle = false,
    selectedSnippet,
    allowCreate = false,
    onCreate,
    onSearchInput,
    onLoadMore,
    loadingMore = false,
    defaultSearch = '',
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

  // --- Filtering ---

  let filteredOptions = $derived.by<NormalizedOption[]>(() => {
    if (!search) return normalizedOptions;
    const lowerSearch = search.toLowerCase();
    return normalizedOptions.filter((opt) => {
      if (opt.label.toLowerCase().includes(lowerSearch)) return true;
      if (opt.value.toLowerCase().includes(lowerSearch)) return true;
      const kws = getSearchKeywords?.(opt.raw) ?? [];
      return kws.some((k) => k.toLowerCase().includes(lowerSearch));
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

  // Infinite scroll — near-bottom hit fires the parent's next-page delegate.
  function handleListScroll(e: Event) {
    if (!onLoadMore || loadingMore) return;
    const el = e.currentTarget as HTMLElement;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 48) onLoadMore();
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
            ? "pointer-events-none cursor-not-allowed opacity-50"
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
              <!-- Created-value chip hugs its content up to the trigger's
                   max, then ellipsizes — never stretches across the input. -->
              <Badge variant="outline" class="gap-1 border-primary-gradient-soft text-foreground w-fit max-w-full justify-start">
                <span class={cn("min-w-0 text-left", truncateFrom === 'start' ? 'truncate-start' : 'truncate')}>
                  {value as string}
                </span>
              </Badge>
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
              {#each selectedValues as val (val)}
                {@const opt = normalizedOptions.find((o) => o.value === val)}
                {@const invalid = isValueInvalid?.(val) ?? false}
                <Badge variant={invalid ? 'destructive' : 'secondary'} class="gap-1" data-invalid={invalid || undefined}>
                  {opt?.label ?? val}
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
    <!-- shouldFilter=false: filtering is owned by `filteredOptions` (label +
         value + getSearchKeywords). bits-ui's internal filter only matches the
         item `value` (+ keywords), which breaks searches by label — e.g. typing
         "dollar" found nothing because the item value is "USD". -->
    <Command.Root shouldFilter={false}>
      {#if searchable}
        <Command.Input
          bind:value={search}
          placeholder={searchPlaceholder ?? $t('app.search.placeholder')}
          onkeydown={(e) => {
            if (e.key === 'Enter' && showCreateItem) {
              e.preventDefault();
              handleCreate();
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
                <div class="combo-select-checkbox h-4 w-4 rounded border border-input shrink-0"></div>
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
          <Command.Empty>{$t('app.common.no_results')}</Command.Empty>
        {:else if visibleOptions.length > 0}
          {#each visibleOptions as opt (opt.value)}
            {@const isDisabled = isOptionDisabled ? isOptionDisabled(opt.raw) : false}
            {@const isSelected = mode === "single" ? (value as string) === opt.value : selectedValues.includes(opt.value)}
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
                  <div class={cn(
                    "combo-select-checkbox h-4 w-4 rounded border shrink-0 flex items-center justify-center",
                    selectedValues.includes(opt.value) ? "bg-primary border-primary" : "border-input",
                  )}>
                    {#if selectedValues.includes(opt.value)}
                      <Check class="h-3 w-3 text-primary-foreground" />
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
        {#if loadingMore}
          <div class="flex items-center justify-center py-2" aria-hidden="true">
            <div class="size-4 animate-spin rounded-full border-2 border-muted border-t-foreground"></div>
          </div>
        {/if}
      </Command.List>
    </Command.Root>
  </Popover.Content>
</Popover.Root>
