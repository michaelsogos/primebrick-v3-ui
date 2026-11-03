<script lang="ts">
  /**
   * ScheduleSpecInput — single-string editor for the NATS `Nats-Schedule`
   * grammar (`@every <dur>` | `@at <RFC3339>` | 5-field cron).
   *
   * Anatomy:
   *   ┌──────────────────────────────────────┐
   *   │ *\/5 * * * *                     [🗓] │  ← free text + assist button
   *   ├──────────────────────────────────────┤
   *   │ ✓ Every 5 minutes                    │  ← live interpreter strip
   *   │ next: 14:50 · 14:55 · 15:00          │
   *   └──────────────────────────────────────┘
   *
   * The free-text field is primary (power users); the assist popover is a
   * structured builder that WRITES the canonical string into the same
   * value — one source of truth, two ways to fill it.
   *
   * Labels are `app.widgets.schedule_spec.*` keys through the ui i18n
   * bridge — the owning translations patch seeds them for every locale.
   */
  import TextInput from '../input/text-input.svelte';
  import * as Popover from '../popover/index.js';
  import * as Choicebox from '../choicebox/index.js';
  import Button from '../button/button.svelte';
  import Badge from '../badge/badge.svelte';
  import { NumericInput } from '../numeric-input/index.js';
  import { ComboSelect } from '../combo-select/index.js';
  import { DateWheelPicker } from '../date-dropper/index.js';
  import { CalendarDateTime, getLocalTimeZone } from '@internationalized/date';
  import { getT, getLocale } from '../../bridges.js';
  import { cn, formatUiDateTime } from '../../utils/index.js';
  import {
    CircleAlert,
    CircleCheck,
  } from '@primebrick/ui/vendor/lucide';
  import {
    describeScheduleSpec,
    nextScheduleRuns,
    parseScheduleSpec,
    type ScheduleDescription,
  } from './parse-schedule-spec.js';
  import type { HTMLInputAttributes } from 'svelte/elements';

  const t = getT();
  const locale = getLocale();

  type AssistMode = 'interval' | 'once' | 'cron';

  let {
    value = $bindable(''),
    id,
    name,
    placeholder,
    readonly = false,
    disabled = false,
    'data-testid': dataTestId = 'schedule-spec-input',
    class: className,
    ...rest
  }: {
    /** The schedule string (canonical wire value). */
    value?: string;
    id?: string;
    name?: string;
    placeholder?: string;
    readonly?: boolean;
    disabled?: boolean;
    'data-testid'?: string;
    class?: string;
  } & Omit<HTMLInputAttributes, 'value' | 'readonly' | 'disabled' | 'placeholder' | 'class' | 'type'> = $props();

  // --- Interpreter strip -------------------------------------------------
  const parsed = $derived(parseScheduleSpec(value));
  const description = $derived(describeScheduleSpec(value, locale()));

  /** Structured descriptor → localized phrase (i18n keys, plural-aware units). */
  function descriptionText(d: ScheduleDescription): string {
    if (d.kind === 'text') return d.text;
    if (d.kind === 'at') {
      return $t('app.widgets.schedule_spec.desc.at', {
        date: formatUiDateTime(d.at, locale()),
      });
    }
    return $t('app.widgets.schedule_spec.desc.every', {
      n: d.n,
      unit: $t(`app.widgets.schedule_spec.unit.${d.unit}.${d.n === 1 ? 'one' : 'other'}`),
    });
  }
  const runs = $derived(nextScheduleRuns(value, 3));

  // --- Assist builder ----------------------------------------------------
  let assistOpen = $state(false);
  let mode = $state<AssistMode>('interval');

  // Interval state — product default: 1 hour.
  let everyN = $state('1');
  let everyUnit = $state('h');
  const unitOptions = [
    { value: 's', label_key: 'app.widgets.schedule_spec.unit.s' },
    { value: 'm', label_key: 'app.widgets.schedule_spec.unit.m' },
    { value: 'h', label_key: 'app.widgets.schedule_spec.unit.h' },
    { value: 'd', label_key: 'app.widgets.schedule_spec.unit.d' },
  ];
  // Once state — CalendarDateTime wall-clock + the picker's selected IANA zone.
  let atValue = $state<CalendarDateTime | null>(null);
  let atTz = $state('');
  // Cron state
  let cronExpr = $state('');

  /** Seed the builder fields from the current spec each time the popover opens. */
  $effect(() => {
    if (assistOpen) seedFromValue();
  });

  function seedFromValue() {
    const p = parseScheduleSpec(value);
    if (p.ok && p.spec.kind === 'every') {
      mode = 'interval';
      const unitMs = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
      // Largest-divisible-unit first — `@every 3600s` must seed "1 hour",
      // not "3600 seconds".
      const u = (['d', 'h', 'm', 's'] as const).find(
        (k) => p.spec.kind === 'every' && p.spec.everyMs % unitMs[k] === 0,
      ) ?? 'm';
      everyUnit = u;
      everyN = p.spec.kind === 'every' ? String(p.spec.everyMs / unitMs[u]) : '1';
    } else if (p.ok && p.spec.kind === 'at') {
      mode = 'once';
      const d = p.spec.at;
      atValue = new CalendarDateTime(
        d.getFullYear(),
        d.getMonth() + 1,
        d.getDate(),
        d.getHours(),
        d.getMinutes(),
        0,
      );
    } else if (p.ok && p.spec.kind === 'cron') {
      mode = 'cron';
      cronExpr = p.spec.expr;
    }
  }

  function applyAssist() {
    if (mode === 'interval') {
      const n = Math.max(1, Math.floor(Number(everyN) || 1));
      value = `@every ${n}${everyUnit}`;
    } else if (mode === 'once') {
      if (atValue) value = `@at ${atValue.toDate(atTz || getLocalTimeZone()).toISOString()}`;
    } else {
      value = cronExpr.trim();
    }
    assistOpen = false;
  }

  const canApply = $derived(
    mode === 'once' ? atValue !== null : mode === 'cron' ? cronExpr.trim() !== '' : Number(everyN) > 0,
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
              icon: 'clipboard-clock',
              label: $t('app.widgets.schedule_spec.assist'),
              onclick: () => (assistOpen = true),
              'data-testid': `${dataTestId}-assist`,
            }]
          : undefined}
        {...rest}
      />
      <Popover.Content class="w-96 space-y-3 p-3" align="end" customAnchor={inputWrap}>
              <!-- Mode selector — choice cards; the selected card hosts its
                   own builder form (radio-group semantics, one value). -->
              <Choicebox.Root
                value={mode}
                onValueChange={(v) => (mode = v as AssistMode)}
                name="schedule-mode"
                data-testid="{dataTestId}-modes"
              >
                <Choicebox.Item value="interval" data-testid="{dataTestId}-mode-interval">
                  <Choicebox.Title>{$t('app.widgets.schedule_spec.mode.interval')}</Choicebox.Title>
                  <Choicebox.Description>{$t('app.widgets.schedule_spec.mode.interval.desc')}</Choicebox.Description>
                  <Choicebox.Indicator />
                  {#if mode === 'interval'}
                    <div class="flex items-center gap-2 pt-3">
                      <span class="shrink-0 text-sm text-muted-foreground">{$t('app.widgets.schedule_spec.every')}</span>
                      <div class="min-w-0 flex-1">
                        <NumericInput
                          type="bigint"
                          type_config={'{"validation":{"unsigned":true}}'}
                          bind:value={everyN}
                          data-testid="{dataTestId}-every-n"
                        />
                      </div>
                      <ComboSelect
                        mode="single"
                        bind:value={everyUnit}
                        options={unitOptions}
                        valueField="value"
                        labelField="label_key"
                        isLabelTranslated={true}
                        searchable={false}
                        class="w-28 shrink-0"
                        data-testid="{dataTestId}-every-unit"
                      />
                    </div>
                  {/if}
                </Choicebox.Item>

                <Choicebox.Item value="once" data-testid="{dataTestId}-mode-once">
                  <Choicebox.Title>{$t('app.widgets.schedule_spec.mode.once')}</Choicebox.Title>
                  <Choicebox.Description>{$t('app.widgets.schedule_spec.mode.once.desc')}</Choicebox.Description>
                  <Choicebox.Indicator />
                  {#if mode === 'once'}
                    <div class="pt-3">
                    <DateWheelPicker
                      bind:value={atValue}
                      bind:timezone={atTz}
                      includeTime={true}
                      dataTestId="{dataTestId}-at-local"
                    />
                    </div>
                  {/if}
                </Choicebox.Item>

                <Choicebox.Item value="cron" data-testid="{dataTestId}-mode-cron">
                  <Choicebox.Title>{$t('app.widgets.schedule_spec.mode.cron')}</Choicebox.Title>
                  <Choicebox.Description>{$t('app.widgets.schedule_spec.mode.cron.desc')}</Choicebox.Description>
                  <Choicebox.Indicator />
                  {#if mode === 'cron'}
                    <div class="pt-3">
                    <TextInput
                      bind:value={cronExpr}
                      placeholder="*/5 * * * *"
                      class="font-mono"
                      data-testid="{dataTestId}-cron-expr"
                    />
                    </div>
                  {/if}
                </Choicebox.Item>
              </Choicebox.Root>

              <div class="-mx-3 -mb-3 flex justify-end border-t bg-muted/50 px-3 py-2">
                <Button
                  type="button"
                  size="xs"
                  disabled={!canApply}
                  data-testid="{dataTestId}-apply"
                  onclick={applyAssist}
                >
                  {$t('app.widgets.schedule_spec.apply')}
                </Button>
              </div>
            </Popover.Content>
    </Popover.Root>
  </div>

  <!-- Interpreter strip -->
  {#if value.trim() !== ''}
    <div
      class="flex items-start gap-1.5 px-1 text-xs"
      data-testid="{dataTestId}-interpreter"
    >
      {#if parsed.ok}
        <CircleCheck class="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
        <div class="min-w-0">
          <span class="font-medium">{$t('app.widgets.schedule_spec.valid')}</span>
          {#if description}
            <span class="text-muted-foreground"> — {descriptionText(description)}</span>
          {/if}
          {#if runs.length > 0}
            <div class="flex flex-wrap items-center gap-1">
              <span class="text-muted-foreground">{$t('app.widgets.schedule_spec.next')}:</span>
              {#each runs as run (run.getTime())}
                <Badge variant="secondary" class="font-normal">{formatUiDateTime(run, locale())}</Badge>
              {/each}
            </div>
          {/if}
        </div>
      {:else}
        <CircleAlert class="mt-0.5 size-3.5 shrink-0 text-destructive" />
        <span class="text-destructive" data-testid="{dataTestId}-error">{parsed.reason}</span>
      {/if}
    </div>
  {/if}
</div>
