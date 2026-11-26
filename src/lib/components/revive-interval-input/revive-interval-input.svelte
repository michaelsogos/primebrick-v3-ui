<script lang="ts">
  /**
   * ReviveIntervalInput — single-string editor for the revive axis grammar
   * (`parseReviveSpec`/`parseGraceSpec` in @primebrick/core):
   *
   *   - interval: `'N unit'` — the closed calendar cadence
   *     (`day|week|month|quarter|year`);
   *   - instant pin: `'at <RFC3339>'` (expire axis) / `'until <RFC3339>'`
   *     (switch axis) — the keyword comes from the `literal` prop.
   *
   * Anatomy mirrors `ScheduleSpecInput` — same grammar of the surface,
   * different algebra of the value:
   *
   *   ┌──────────────────────────────────────┐
   *   │ 1 year                           [🗓] │  ← canonical text + assist CTA
   *   ├──────────────────────────────────────┤
   *   │ ✓ Renews every 1 year, aligned …     │  ← live interpreter strip
   *   └──────────────────────────────────────┘
   *
   * The free-text field is primary and carries the canonical varchar
   * verbatim — what the wire validator and the DB round-trip, and what
   * filter criteria ILIKE-match. The assist popover is a structured
   * builder that WRITES the canonical into the same value — one source
   * of truth, two ways to fill it. Exactly TWO modes (interval / fixed
   * date): the revive algebra has no cron and no sub-day units, so the
   * builder cannot author them.
   *
   * Labels are `app.widgets.revive_interval.*` keys through the ui i18n
   * bridge — the owning translations patch seeds them for every locale.
   */
  import TextInput from '../input/text-input.svelte';
  import * as Popover from '../popover/index.js';
  import * as Choicebox from '../choicebox/index.js';
  import Button from '../button/button.svelte';
  import { NumericInput } from '../numeric-input/index.js';
  import type { UomOption } from '../../composables/useNumericInput.svelte.js';
  import { DateWheelPicker } from '../date-dropper/index.js';
  import { CalendarDateTime, getLocalTimeZone } from '@internationalized/date';
  import { getT, getLocale } from '../../bridges.js';
  import { cn, getResolvedIanaTimeZone } from '../../utils/index.js';
  import {
    CircleAlert,
    CircleCheck,
    Info,
  } from '@primebrick/ui/vendor/lucide';
  import type { SequenceReviveUnit } from '@primebrick/core';
  import {
    describeReviveAxis,
    parseReviveAxisSpec,
    reviveIntervalCanonical,
    type ReviveLiteral,
  } from '../../utils/revive-spec.js';
  import { formatUiDateTime, formatUiDateTimeInTimeZone } from '../../utils/format-date.js';
  import type { HTMLInputAttributes } from 'svelte/elements';

  const t = getT();
  const locale = getLocale();

  type AssistMode = 'interval' | 'pin';

  /** The closed unit vocabulary — order IS the dropdown order. Exactly five,
   *  the internal-dropdown ceiling of NumericInput (no picker sheet). */
  const UNITS: readonly SequenceReviveUnit[] = ['day', 'week', 'month', 'quarter', 'year'];

  let {
    value = $bindable(''),
    literal = 'at',
    id,
    name,
    placeholder,
    readonly = false,
    disabled = false,
    'data-testid': dataTestId = 'revive-interval-input',
    class: className,
    ...rest
  }: {
    /** The spec canonical string — `'N unit'` or `'<keyword> <RFC3339>'`. */
    value?: string;
    /** The instant-literal keyword this axis emits — `'at'` pins the
     *  expire axis (`revive_interval`), `'until'` the switch axis
     *  (`revive_offset`). Cross-axis keywords are rejected by the wire
     *  validator — the control never emits them. */
    literal?: 'at' | 'until';
    id?: string;
    name?: string;
    placeholder?: string;
    readonly?: boolean;
    disabled?: boolean;
    'data-testid'?: string;
    class?: string;
  } & Omit<HTMLInputAttributes, 'value' | 'readonly' | 'disabled' | 'placeholder' | 'class' | 'type'> = $props();

  const axisLiteral = $derived<ReviveLiteral>(literal);

  // --- Interpreter strip -------------------------------------------------
  const description = $derived(describeReviveAxis(value, axisLiteral));

  // Pin instants are absolute — render them in the app's resolved zone
  // (the same source the top bar reads), not the browser default.
  const appTz = getResolvedIanaTimeZone();
  const pinLabel = (d: Date) =>
    appTz ? formatUiDateTimeInTimeZone(d, locale(), appTz) : formatUiDateTime(d, locale());

  /** Plural-aware unit prose — `unit.<unit>.one/other` keys. */
  const unitProse = (n: number, unit: SequenceReviveUnit) =>
    $t(`app.widgets.revive_interval.unit.${unit}.${n === 1 ? 'one' : 'other'}`);

  /** First-letter uppercasing for standalone unit labels — a no-op for
   *  German (nouns born capitalized), correct for the other six locales. */
  const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  // --- Assist builder ----------------------------------------------------
  let assistOpen = $state(false);
  let mode = $state<AssistMode>('interval');

  // Interval state — product default: 1 year (the dominant cadence in
  // real data; the old composite defaulted the same way).
  let everyN = $state('1');
  let everyUnit = $state<SequenceReviveUnit>('year');
  /** CTA label — the SAME plural agreement as the strip prose,
   *  standalone-capitalized: the seeded `.one/.other` forms are lowercase
   *  sentence prose, the adornment is a label. */
  const uomCtaSymbol = $derived(cap(unitProse(Number(everyN) || 0, everyUnit)));
  const unitOptions: UomOption[] = UNITS.map((u) => ({
    code: u,
    label_key: `app.widgets.revive_interval.unit.${u}`,
  }));

  // Pin state — CalendarDateTime wall-clock + the picker's selected IANA zone.
  let pinValue = $state<CalendarDateTime | null>(null);
  let pinTz = $state('');
  // Pins must stay future at write time (the wire validation re-checks at
  // submit) — the picker cannot commit a past instant. Filter matching of
  // past pins stays possible through the free-text field.
  let pinMin = $state<Date | undefined>(undefined);

  /** Seed the builder fields from the current spec each time the popover opens. */
  $effect(() => {
    if (assistOpen) {
      seedFromValue();
      pinMin = new Date();
    }
  });

  function seedFromValue() {
    const p = parseReviveAxisSpec(value, axisLiteral);
    if (p?.kind === 'interval') {
      mode = 'interval';
      everyN = String(p.count);
      everyUnit = p.unit;
    } else if (p?.kind === 'at') {
      mode = 'pin';
      const d = p.at;
      pinValue = new CalendarDateTime(
        d.getFullYear(),
        d.getMonth() + 1,
        d.getDate(),
        d.getHours(),
        d.getMinutes(),
        d.getSeconds(),
      );
    }
    // Foreign/empty text keeps the previous builder state — composing from
    // scratch must not destroy a half-authored draft on popover reopen.
  }

  function applyAssist() {
    if (mode === 'interval') {
      value = reviveIntervalCanonical(Number(everyN) || 1, everyUnit);
    } else if (pinValue) {
      value = `${axisLiteral} ${pinValue.toDate(pinTz || getLocalTimeZone()).toISOString()}`;
    }
    assistOpen = false;
  }

  const canApply = $derived(
    mode === 'interval' ? Number(everyN) > 0 : pinValue !== null,
  );

  // The assist CTA is declared via `trailing_ctas` — TextInput owns the
  // slot geometry; the popover anchors to the field wrapper.
  let inputWrap: HTMLElement | undefined = $state();
</script>

<div class={cn('space-y-1', className)} data-testid={dataTestId}>
  <div class="relative" bind:this={inputWrap}>
    <Popover.Root bind:open={assistOpen}>
      <TextInput
        {id}
        {name}
        bind:value
        {placeholder}
        {readonly}
        {disabled}
        data-testid="{dataTestId}-field"
        trailing_ctas={!readonly && !disabled
          ? [{
              icon: 'calendar-clock',
              label: $t('app.widgets.revive_interval.assist'),
              onclick: () => (assistOpen = true),
              'data-testid': `${dataTestId}-assist`,
            }]
          : undefined}
        {...rest}
      />
      <Popover.Content class="w-96 space-y-3 p-3" align="end" customAnchor={inputWrap}>
        <!-- Mode selector — choice cards; the selected card hosts its own
             builder form (radio-group semantics, one value). Exactly two:
             the revive algebra has no cron and no sub-day units. -->
        <Choicebox.Root
          value={mode}
          onValueChange={(v) => (mode = v as AssistMode)}
          name="revive-mode"
          data-testid="{dataTestId}-modes"
        >
          <Choicebox.Item value="interval" data-testid="{dataTestId}-mode-interval">
            <Choicebox.Title>{$t('app.widgets.revive_interval.mode.interval')}</Choicebox.Title>
            <Choicebox.Description>{$t('app.widgets.revive_interval.mode.interval.desc')}</Choicebox.Description>
            <Choicebox.Indicator />
            {#if mode === 'interval'}
              <div class="flex items-center gap-2 pt-3">
                <span class="shrink-0 text-sm text-muted-foreground">{$t('app.widgets.revive_interval.mode.every')}</span>
                <div class="min-w-0 flex-1">
                  <NumericInput
                    kind="bigint"
                    unsigned={true}
                    steppers={false}
                    bind:value={everyN}
                    uom={{
                      kind: 'custom',
                      code: everyUnit,
                      symbol: uomCtaSymbol,
                      options: unitOptions,
                      on_uom_change: (c) => (everyUnit = c as SequenceReviveUnit),
                    }}
                    data-testid="{dataTestId}-every-n"
                  />
                </div>
              </div>
            {/if}
          </Choicebox.Item>

          <Choicebox.Item value="pin" data-testid="{dataTestId}-mode-pin">
            <Choicebox.Title>{$t('app.widgets.revive_interval.mode.pin')}</Choicebox.Title>
            <Choicebox.Description>{$t('app.widgets.revive_interval.mode.pin.desc')}</Choicebox.Description>
            <Choicebox.Indicator />
            {#if mode === 'pin'}
              <div class="pt-3">
                <DateWheelPicker
                  bind:value={pinValue}
                  bind:timezone={pinTz}
                  includeTime={true}
                  minValue={pinMin}
                  dataTestId="{dataTestId}-pin"
                />
              </div>
            {/if}
          </Choicebox.Item>
        </Choicebox.Root>

        <div class="-mx-3 -mb-3 flex items-center justify-end gap-2 border-t bg-muted/50 px-3 py-2">
          <Button
            type="button"
            size="xs"
            disabled={!canApply}
            data-testid="{dataTestId}-apply"
            onclick={applyAssist}
          >
            {$t('app.common.apply')}
          </Button>
        </div>
      </Popover.Content>
    </Popover.Root>
  </div>

  <!-- Interpreter strip — empty is first-class: NULL carries the
       revive-off / no-grace semantics and the strip says so. -->
  <div
    class="flex items-start gap-1.5 px-1 text-xs"
    data-testid="{dataTestId}-interpreter"
  >
    {#if description.kind === 'empty'}
      <Info class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <span class="text-muted-foreground">
        {$t(`app.widgets.revive_interval.desc.empty.${axisLiteral}`)}
      </span>
    {:else if description.kind === 'interval'}
      <CircleCheck class="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
      <span class="text-muted-foreground">
        {$t(`app.widgets.revive_interval.desc.interval.${axisLiteral}`, {
          n: description.n,
          unit: unitProse(description.n, description.unit),
        })}
      </span>
    {:else if description.kind === 'pin'}
      <CircleCheck class="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
      <span class="text-muted-foreground">
        {$t(`app.widgets.revive_interval.desc.pin.${axisLiteral}`, { date: pinLabel(description.at) })}
        {#if appTz}
          <span class="text-muted-foreground/70">· {appTz}</span>
        {/if}
      </span>
    {:else}
      <CircleAlert class="mt-0.5 size-3.5 shrink-0 text-destructive" />
      <span class="text-destructive" data-testid="{dataTestId}-error">
        {$t('app.widgets.revive_interval.invalid')}
      </span>
    {/if}
  </div>
</div>
