<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import { cn, type WithElementRef } from "../../utils/index.js";
  import {
    InputGroup,
    InputGroupButton,
    InputGroupInput,
  } from "../input-group/index.js";
  import { getT } from "../../bridges.js";
  import { Braces, Eraser } from "@primebrick/ui/vendor/lucide";

  /** Helpers handed to the host's token surface (sheet) when the CTA
   *  fires. `caret` is the tracked selection SNAPSHOT at open time —
   *  `null` when the field was never careted (untouched = append). The
   *  host's `insert` should prefer the input's LIVE DOM selection when
   *  present (it survives blur and post-open caret moves), falling back
   *  to this snapshot only when the DOM reports a cleared `{0,0}`. */
  export interface SequencePatternPick {
    get_value: () => string;
    caret: { start: number; end: number } | null;
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
    // `caret` is already live — every real focus/select/key/click tracked
    // it. Do NOT resample here: an untouched input reports `0` and would
    // forge a `{0,0}` caret; `null` is the "untouched → append" flag.
    on_pick?.({
      get_value: () => value ?? "",
      caret: caret ? { start: caret.start, end: caret.end } : null,
      context,
    });
  }

  let canClear = $derived(value !== "" && !isDisabled);
  function clearValue() {
    value = "";
    onChange?.("");
    caret = null;
    inputRef?.focus();
  }
</script>

<div class="w-full">
  <InputGroup
    class="group/input border-primary-gradient hover:brightness-105 focus-within:ring-2 focus-within:ring-ring/50 rounded-md transition-all duration-200 {cn(className)}"
  >
    <InputGroupInput
      bind:ref={inputRef}
      bind:value
      oninput={handleInput}
      onclick={trackCaret}
      onkeyup={trackCaret}
      onselect={trackCaret}
      onfocus={trackCaret}
      class={cn("font-mono")}
      aria-invalid={errors.length > 0 || restProps["aria-invalid"] === "true" || restProps["aria-invalid"] === true}
      data-testid={restProps["data-testid"]}
      placeholder={restProps.placeholder}
      {disabled}
      {readonly}
      required={restProps.required}
      id={restProps.id}
      name={restProps.name}
    />

    {#if on_pick}
      <InputGroupButton
        variant="ghost"
        size="xs"
        class="h-full rounded-none px-3 text-muted-foreground hover:text-foreground hover:brightness-105 transition-colors disabled:opacity-40"
        onclick={openTokens}
        disabled={isDisabled}
        aria-label={$t("app.widgets.sequence_pattern.tokens_cta")}
        title={$t("app.widgets.sequence_pattern.tokens_cta")}
        data-testid={`${restProps["data-testid"] ?? "sequence-pattern-input"}-tokens-cta`}
      >
        <Braces class="size-4" />
      </InputGroupButton>
    {/if}

    <InputGroupButton
      variant="ghost"
      size="xs"
      class="h-full rounded-r-md rounded-l-none px-3 text-muted-foreground hover:text-foreground hover:brightness-105 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted-foreground"
      onclick={clearValue}
      disabled={!canClear}
      tabindex={-1}
      aria-label={$t("app.common.reset")}
      title={$t("app.common.reset")}
      data-testid={`${restProps["data-testid"] ?? "sequence-pattern-input"}-clear`}
    >
      <Eraser class="size-4" />
    </InputGroupButton>
  </InputGroup>
</div>
