<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import { cn, type WithElementRef } from "../../utils/index.js";
  import { tick } from "svelte";
  import Input from "../input/input.svelte";
  import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
    InputGroupText,
  } from "../input-group/index.js";
  import {
    useNumericInput,
    type NumericKind,
    type NumericUomSpec,
  } from "../../composables/useNumericInput.svelte.js";
  import { getT } from "../../bridges.js";
  import type { Decimal } from "@primebrick/core";
  const t = getT();
  import { ChevronDown, Plus, Minus, Eraser } from "@primebrick/ui/vendor/lucide";

  type NumericAlign = "left" | "center" | "right";

  type Props = WithElementRef<
    Omit<HTMLInputAttributes, "type" | "files"> & {
      /**
       * Numeric kind — drives inputmode, character filtering, and native
       * type conversion (bigint → BigInt math, decimal → @primebrick/decimal
       * exact arithmetic, number → JS double). Resolved from the column
       * contract via `numericKindOf` — never guessed by the host.
       */
      kind: NumericKind;
      /**
       * Resolved unit-of-measure spec — percent (÷100 emit / ×100 display),
       * currency (symbol + picker CTA), or custom (symbol/position +
       * optional before_return/after_receive hooks). The contract-level
       * declaration lives on `MetaColumn.uom`; hosts resolve it here.
       */
      uom?: NumericUomSpec;
      /**
       * type_config JSON string — parsed for `validation.unsigned` and
       * `validation.rules.min/max` when the props don't state them.
       */
      type_config?: string | null;
      /**
       * Bindable value — accepts string | bigint | number | Decimal.
       * The composable converts to/from a local canonical string for the
       * input element; emitted values are always canonical strings
       * (PG form — never a `"…d"` wire suffix).
       */
      value?: string | bigint | number | Decimal;
      /** Optional callback fired on blur/step with the canonical string value. */
      onChange?: (value: string) => void;
      /** Errors array (i18n keys in `key|jsonParams` format) — renders below input. */
      errors?: string[];
      /** Increment/decrement buttons (`+` inline-start, `−` inline-end) —
       *  default true. The buttons commit the value immediately. */
      steppers?: boolean;
      /** Step amount — canonical string; default `"1"` (bigint) / `"1.0"`
       *  (number/decimal). Must be non-zero and ≤ (max − min) when both
       *  bounds exist; signed values allowed. */
      step?: string;
      /** Text alignment of the value — default `"left"`, matching every
       *  sibling field (placeholder included). `"right"` (spreadsheet
       *  convention) / `"center"` are opt-in. */
      align?: NumericAlign;
      /** Eraser trailing CTA — canonical anatomy: always rendered, disabled
       *  when the value is empty. Default `true`. */
      clearable?: boolean;
      /** Unsigned — `-` is rejected by the char filter; also forwarded to
       *  aria bounds (min becomes 0 when no stricter min applies). */
      unsigned?: boolean;
      /** Direct bounds — win over `type_config.validation.rules`. */
      min?: string | number | bigint;
      max?: string | number | bigint;
      /**
       * BCP 47 language tag (e.g. 'it-IT', 'en-GB') — drives locale-aware
       * thousand separators and decimal separator in the display value.
       */
      lang?: string;
    }
  >;

  let {
    ref = $bindable(null),
    kind,
    uom,
    type_config = null,
    value = $bindable(""),
    onChange,
    errors = [],
    steppers = true,
    step,
    align = "left",
    clearable = true,
    unsigned,
    min,
    max,
    lang = "en-GB",
    class: className,
    ...restProps
  }: Props = $props();

  // InputGroupInput expects HTMLInputElement | null | undefined, but WithElementRef
  // gives HTMLElement | null. Cast to satisfy the type.
  let inputRef = $derived(ref as HTMLInputElement | null);

  const num = useNumericInput({
    kind: () => kind,
    type_config: () => type_config,
    value: () => value,
    lang: () => lang,
    uom: () => uom,
    unsigned: () => unsigned,
    min: () => min,
    max: () => max,
    step: () => step,
    props: () => ({ kind, uom, step, align, min, max, lang, disabled: restProps.disabled }),
  });

  // ── UoM adornment resolution ─────────────────────────────────────────
  let uomSpec = $derived(uom);
  let uomSymbol = $derived(
    uomSpec?.kind === "percent"
      ? "%"
      : (uomSpec?.symbol ?? uomSpec?.code ?? ""),
  );
  let uomIsPrefix = $derived(
    (uomSpec?.position ?? (uomSpec?.kind === "currency" ? "prefix" : "suffix")) === "prefix",
  );
  let hasUomAdornment = $derived(!!uomSpec && (uomSymbol !== "" || !!uomSpec.on_pick));
  let hasUomCta = $derived(!!uomSpec?.on_pick);

  // Group chrome is needed whenever steppers, a uom adornment or the
  // eraser trailing CTA render — i.e. always; the plain-Input branch only
  // survives clearable=false + steppers=false + no uom (display-only cases).
  let needGroup = $derived(steppers || hasUomAdornment || clearable);

  // Sync from prop when external value changes (e.g. form reset, SuperForms reset).
  // The composable pushes the canonical through after_receive (percent ×100).
  let lastValue = $state<string>(String(value ?? ""));
  $effect(() => {
    const str = String(value ?? "");
    if (str !== lastValue) {
      num.syncFromProp();
      lastValue = str;
    }
  });

  // oninput — parse display → canonical, filter invalid chars, restore cursor
  async function handleInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const oldDisplay = input.value;
    const cursorPos = input.selectionStart ?? 0;
    num.filterInput(oldDisplay);
    // Wait for Svelte to re-render displayValue, then restore cursor
    await tick();
    const newDisplay = num.displayValue;
    // When the filter strips an invalid char without changing the canonical
    // value, Svelte sees `value={num.displayValue}` as unchanged and does NOT
    // rewrite the DOM — the rejected char would stay visible. Force the
    // writeback so the input always shows the filtered display value.
    if (input.value !== newDisplay) {
      input.value = newDisplay;
    }
    const newPos = num.computeCursorPosition(cursorPos, oldDisplay, newDisplay);
    if (inputRef) {
      inputRef.setSelectionRange(newPos, newPos);
    }
  }

  /** Commit — normalize, clamp to bounds, emit through before_return,
   *  write the canonical value back to the bound prop. */
  function commit() {
    num.normalize();
    num.clamp();
    const canonical = num.emit();
    if (canonical !== lastValue) {
      lastValue = canonical;
      value = canonical;
      onChange?.(canonical);
    }
  }

  // onblur — normalize leading zeros, clamp out-of-bounds (hint below),
  // then notify parent with the canonical string value.
  function handleBlur() {
    commit();
  }

  // Steppers — commit immediately (a click is a value decision, not a draft).
  function stepBy(dir: 1 | -1) {
    if (num.stepBy(dir)) commit();
  }

  // Keyboard stepping — WAI-ARIA spinbutton contract.
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      stepBy(1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      stepBy(-1);
    } else if (e.key === "PageUp" && num.stepDec) {
      e.preventDefault();
      for (let i = 0; i < 10 && num.stepBy(1); i++);
      commit();
    } else if (e.key === "PageDown" && num.stepDec) {
      e.preventDefault();
      for (let i = 0; i < 10 && num.stepBy(-1); i++);
      commit();
    }
  }

  // Error rendering — same `key|jsonParams` translation pattern as ConfigValueInput
  let firstError = $derived(errors.length > 0 ? errors[0] : "");
  let hasError = $derived(!!firstError);

  function translateError(error: string): string {
    if (!error.includes("|")) return $t(error);
    const [key, jsonParams] = error.split("|", 2);
    try {
      // standards-exempt: ext-json — `key|{json}` is the plain-JSON translation-params contract
      const params = JSON.parse(jsonParams);
      return $t(key, params);
    } catch {
      return $t(key);
    }
  }

  // Out-of-bounds hint — the clamp fired on blur: "non sono ammessi valori
  // inferiori/superiori a X" with the bound in DISPLAY units.
  let oobError = $derived(
    num.oobIssue
      ? `app.common.validation.${num.oobIssue}|{"${num.oobIssue === "minimum" ? "min" : "max"}":"${num.oobBound}"}`
      : "",
  );

  let translatedError = $derived(firstError ? translateError(firstError) : "");
  let shownError = $derived(translatedError || (oobError ? translateError(oobError) : ""));

  // Forward the uom CTA click — the host owns the picker surface
  // (e.g. opens the currency selection sheet with the change callback).
  function openUomSheet() {
    uomSpec?.on_pick?.();
  }

  // Spinbutton aria — the input advertises the numeric role and bounds.
  let ariaValueNow = $derived.by<number | undefined>(() => {
    const raw = num.rawValue;
    if (raw === "" || raw === "-") return undefined;
    const n = Number(raw);
    return Number.isNaN(n) ? undefined : n;
  });

  // aria bounds speak display units — consistent with aria-valuenow.
  let ariaValueMin = $derived.by<number | undefined>(() => {
    const v = num.displayMin;
    if (v === null) return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  });
  let ariaValueMax = $derived.by<number | undefined>(() => {
    const v = num.displayMax;
    if (v === null) return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  });

  let alignClass = $derived(
    align === "center" ? "text-center" : align === "left" ? "text-left" : "text-right",
  );

  let baseTestId = $derived(restProps["data-testid"] ?? "numeric-input");
  let isDisabled = $derived(!!restProps.disabled || !!restProps.readonly);

  /** Trailing-CTA anatomy — eraser clears the canonical value, always
   *  rendered, disabled while the field is empty/readonly/disabled. */
  let canClear = $derived(clearable && num.rawValue !== "" && !isDisabled);
  function clearValue() {
    num.rawValue = "";
    commit();
    inputRef?.focus();
  }
</script>

<div class="w-full">
  {#if needGroup}
    <InputGroup
      class="group/input border-primary-gradient hover:brightness-105 focus-within:ring-2 focus-within:ring-ring/50 rounded-md transition-all duration-200 {className}"
    >
      {#if steppers}
        <InputGroupButton
          variant="ghost"
          size="xs"
          class="h-full rounded-l-md rounded-r-none px-3 text-muted-foreground hover:text-foreground hover:brightness-105 transition-colors disabled:opacity-40 disabled:hover:text-muted-foreground"
          onclick={() => stepBy(1)}
          disabled={isDisabled || num.atMax}
          aria-label={$t("app.widgets.numeric_input.increment")}
          data-testid="{baseTestId}-inc"
        >
          <Plus class="size-4" />
        </InputGroupButton>
      {/if}

      {#if hasUomAdornment && uomIsPrefix}
        {#if hasUomCta}
          <InputGroupButton
            variant="ghost"
            size="xs"
            class="h-full rounded-none border-right-primary-gradient-soft hover:brightness-105 transition-colors"
            onclick={openUomSheet}
            disabled={isDisabled}
            data-testid="{baseTestId}-uom-cta"
          >
            <span class="font-medium">{uomSymbol}</span>
            {#if uomSpec?.code && uomSpec.code !== uomSymbol}
              <span class="font-mono text-sm ml-1">{uomSpec.code}</span>
            {/if}
            <ChevronDown class="size-3 ml-0.5 opacity-60" />
          </InputGroupButton>
        {:else}
          <InputGroupAddon
            align="inline-start"
            class="bg-transparent border-none pr-0"
          >
            <span class="text-sm font-medium text-muted-foreground">{uomSymbol}</span>
          </InputGroupAddon>
        {/if}
      {/if}

      <InputGroupInput
        bind:ref={inputRef}
        role="spinbutton"
        inputmode={num.inputMode}
        value={num.displayValue}
        oninput={handleInput}
        onblur={handleBlur}
        onkeydown={handleKeydown}
        aria-invalid={hasError || !!num.oobIssue || restProps["aria-invalid"] === "true" || restProps["aria-invalid"] === true}
        aria-valuemin={ariaValueMin}
        aria-valuemax={ariaValueMax}
        aria-valuenow={ariaValueNow}
        aria-valuetext={num.displayValue}
        class={cn(alignClass, "tabular-nums")}
        data-testid={restProps["data-testid"]}
        placeholder={restProps.placeholder}
        disabled={restProps.disabled}
        readonly={restProps.readonly}
        required={restProps.required}
        id={restProps.id}
        name={restProps.name}
      />

      {#if hasUomAdornment && !uomIsPrefix}
        {#if hasUomCta}
          <InputGroupButton
            variant="ghost"
            size="xs"
            class="h-full rounded-none hover:brightness-105 transition-colors"
            onclick={openUomSheet}
            disabled={isDisabled}
            data-testid="{baseTestId}-uom-cta"
          >
            <span class="font-medium">{uomSymbol}</span>
            {#if uomSpec?.code && uomSpec.code !== uomSymbol}
              <span class="font-mono text-sm ml-1">{uomSpec.code}</span>
            {/if}
            <ChevronDown class="size-3 ml-0.5 opacity-60" />
          </InputGroupButton>
        {:else}
          <InputGroupText class="bg-transparent border-none pl-0 text-muted-foreground">
            {uomSymbol}
          </InputGroupText>
        {/if}
      {/if}

      {#if steppers}
        <InputGroupButton
          variant="ghost"
          size="xs"
          class="h-full rounded-none px-3 text-muted-foreground hover:text-foreground hover:brightness-105 transition-colors disabled:opacity-40 disabled:hover:text-muted-foreground"
          onclick={() => stepBy(-1)}
          disabled={isDisabled || num.atMin}
          aria-label={$t("app.widgets.numeric_input.decrement")}
          data-testid="{baseTestId}-dec"
        >
          <Minus class="size-4" />
        </InputGroupButton>
      {/if}

      {#if clearable}
        <InputGroupButton
          variant="ghost"
          size="xs"
          class="h-full rounded-r-md rounded-l-none px-3 text-muted-foreground hover:text-foreground hover:brightness-105 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted-foreground"
          onclick={clearValue}
          disabled={!canClear}
          tabindex={-1}
          aria-label={$t("app.common.reset")}
          title={$t("app.common.reset")}
          data-testid="{baseTestId}-clear"
        >
          <Eraser class="size-4" />
        </InputGroupButton>
      {/if}
    </InputGroup>
  {:else}
    <Input
      bind:ref
      type="text"
      role="spinbutton"
      inputmode={num.inputMode}
      value={num.displayValue}
      oninput={handleInput}
      onblur={handleBlur}
      onkeydown={handleKeydown}
      aria-invalid={hasError || !!num.oobIssue || restProps["aria-invalid"] === "true" || restProps["aria-invalid"] === true}
      aria-valuemin={ariaValueMin}
      aria-valuemax={ariaValueMax}
      aria-valuenow={ariaValueNow}
      aria-valuetext={num.displayValue}
      class={cn("w-full", alignClass, "tabular-nums", className)}
      data-testid={restProps["data-testid"]}
      placeholder={restProps.placeholder}
      disabled={restProps.disabled}
      readonly={restProps.readonly}
      required={restProps.required}
      id={restProps.id}
      name={restProps.name}
    />
  {/if}
  {#if shownError}
    <p class="text-xs text-destructive mt-1">{shownError}</p>
  {/if}
</div>
