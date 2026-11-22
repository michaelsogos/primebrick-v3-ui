<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import { cn, type WithElementRef } from "../../utils/index.js";
  import Input from "../input/input.svelte";
  import { inputTrailingIconButtonClasses } from "../input/input-chrome.js";
  import { getT } from "../../bridges.js";
  import { Eraser, Tags } from "@primebrick/ui/vendor/lucide";

  /** Helpers handed to the host's token surface (sheet) when the CTA
   *  fires. `get_caret` reads the widget's CURRENT tracked selection —
   *  live across sheet-stack remounts (the fresh widget keeps tracking
   *  its own focus/select/key/click); `null` while the field was never
   *  careted (untouched = append). The host's `insert` should prefer the
   *  input's LIVE DOM selection when present, falling back to
   *  `get_caret()` only when the DOM reports a cleared `{0,0}` — which
   *  is exactly why a getter beats a snapshot: a click at position 0
   *  post-open must still land at 0. */
  export interface SequencePatternPick {
    get_value: () => string;
    get_caret: () => { start: number; end: number } | null;
    /** The form record — the sheet's example context reads `step`/`start`/
     *  `tz` when the authoring surface carries them (illustrative only:
     *  partitions are claim-time context, never persisted). */
    context?: Record<string, unknown>;
  }

  type Props = WithElementRef<
    Omit<HTMLInputAttributes, "type" | "files"> & {
      /** Bindable value — the authored pattern string, persisted verbatim. */
      value?: string;
      onChange?: (value: string) => void;
      errors?: string[];
      readonly?: boolean;
      disabled?: boolean;
      /** Host-injected token-surface opener — ui stays environment-neutral
       *  (same contract as `NumericUomSpec.on_pick`): the dispatcher wires
       *  `openSheet('entity.sequencePattern', …)`. */
      on_pick?: (pick: SequencePatternPick) => void;
      /** Example context for previews — the form record when the surface
       *  carries `step`/`start`/`tz` siblings. */
      context?: Record<string, unknown>;
    }
  >;

  let {
    ref = $bindable(null),
    value = $bindable(""),
    onChange,
    errors = [],
    readonly = false,
    disabled = false,
    on_pick,
    context,
    class: className,
    ...restProps
  }: Props = $props();

  const t = getT();

  /** The live input element — `bind:ref` is a PROP-TO-PROP bind (the
   *  canonical ui convention): `ref` is the $bindable prop itself, so the
   *  element reaches both us and any parent that bound it. */
  let inputRef = $derived(ref as HTMLInputElement | null);
  let isDisabled = $derived(disabled || readonly);

  /** Last observed selection — preserved across the blur that opening the
   *  token sheet causes, so insertion lands where the cursor was. `null`
   *  until the user actually selects/carets: an untouched field appends. */
  let caret = $state<{ start: number; end: number } | null>(null);

  function trackCaret() {
    const el = inputRef;
    if (!el) return;
    caret = { start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 };
  }

  function handleInput(_e: Event) {
    trackCaret();
  }

  function openTokens() {
    if (isDisabled) return;
    // Hand the host a live getter, not a snapshot — `caret` keeps
    // tracking after the sheet opens (and after pane remounts). `null`
    // stays the "untouched → append" flag: an input that was never
    // careted must not forge `{0,0}`.
    on_pick?.({
      get_value: () => value ?? "",
      get_caret: () => (caret ? { start: caret.start, end: caret.end } : null),
      context,
    });
  }

  let canClear = $derived(value !== "" && !isDisabled);
  function clearValue() {
    const el = inputRef;
    if (el) {
      // DOM channel — same as host inserts: el.value + a bubbling `input`
      // event rides the real bind chain AND notifies every `input`
      // listener (the token sheet's on_change feed) — clearing via this
      // CTA must be indistinguishable from keyboard deletion.
      el.value = "";
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    } else {
      value = "";
    }
    onChange?.("");
    caret = null;
    el?.focus();
  }
</script>

<div class="relative w-full">
  <Input
    bind:ref
    bind:value
    oninput={handleInput}
    onclick={trackCaret}
    onkeyup={trackCaret}
    onselect={trackCaret}
    onfocus={trackCaret}
    class={cn("font-mono", on_pick ? "pr-14" : "pr-8", className)}
    aria-invalid={errors.length > 0 || restProps["aria-invalid"] === "true" || restProps["aria-invalid"] === true}
    data-testid={restProps["data-testid"]}
    placeholder={restProps.placeholder}
    {disabled}
    {readonly}
    required={restProps.required}
    id={restProps.id}
    name={restProps.name}
  />

  <!-- Trailing CTAs — input-chrome convention (command-input/cron-input):
       rightmost CTA at `right-1.5` (symmetric to px-3), the second slot at
       `right-10`; ghost icon chips, `tabindex=-1` — they never enter the
       form's tab order. -->
  {#if on_pick}
    <button
      type="button"
      class={cn(inputTrailingIconButtonClasses, "right-10")}
      onclick={openTokens}
      disabled={isDisabled}
      tabindex={-1}
      aria-label={$t("app.widgets.sequence_pattern.tokens_cta")}
      title={$t("app.widgets.sequence_pattern.tokens_cta")}
      data-testid={`${restProps["data-testid"] ?? "sequence-pattern-input"}-tokens-cta`}
    >
      <Tags class="size-4" />
    </button>
  {/if}

  <button
    type="button"
    class={inputTrailingIconButtonClasses}
    onclick={clearValue}
    disabled={!canClear}
    tabindex={-1}
    aria-label={$t("app.common.reset")}
    title={$t("app.common.reset")}
    data-testid={`${restProps["data-testid"] ?? "sequence-pattern-input"}-clear`}
  >
    <Eraser class="size-4" />
  </button>
</div>
