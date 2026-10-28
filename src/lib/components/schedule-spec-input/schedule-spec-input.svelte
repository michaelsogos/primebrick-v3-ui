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
  import Button from '../button/button.svelte';
  import { getT, getLocale } from '../../bridges.js';
  import { cn, formatUiDateTime } from '../../utils/index.js';
  import { inputTrailingIconButtonClasses } from '../input/input-chrome.js';
  import {
    ClipboardClock,
    CircleAlert,
    CircleCheck,
  } from '@primebrick/ui/vendor/lucide';
  import {
    describeScheduleSpec,
    nextScheduleRuns,
    parseScheduleSpec,
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
  const description = $derived(describeScheduleSpec(value));
  const runs = $derived(nextScheduleRuns(value, 3));

  // --- Assist builder ----------------------------------------------------
  let assistOpen = $state(false);
  let mode = $state<AssistMode>('interval');

  // Interval state
  let everyN = $state(5);
  let everyUnit = $state<'s' | 'm' | 'h' | 'd'>('m');
  // Once state — datetime-local format
  let atLocal = $state('');
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
      const u = (Object.keys(unitMs) as Array<keyof typeof unitMs>).find(
        (k) => p.spec.kind === 'every' && p.spec.everyMs % unitMs[k] === 0,
      ) ?? 'm';
      everyUnit = u;
      everyN = p.spec.kind === 'every' ? p.spec.everyMs / unitMs[u] : 5;
    } else if (p.ok && p.spec.kind === 'at') {
      mode = 'once';
      const d = p.spec.at;
      const pad = (n: number) => String(n).padStart(2, '0');
      atLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } else if (p.ok && p.spec.kind === 'cron') {
      mode = 'cron';
      cronExpr = p.spec.expr;
    }
  }

  function applyAssist() {
    if (mode === 'interval') {
      const n = Math.max(1, Math.floor(everyN || 1));
      value = `@every ${n}${everyUnit}`;
    } else if (mode === 'once') {
      const d = new Date(atLocal);
      if (!Number.isNaN(d.getTime())) value = `@at ${d.toISOString()}`;
    } else {
      value = cronExpr.trim();
    }
    assistOpen = false;
  }

  const canApply = $derived(
    mode === 'once' ? atLocal !== '' : mode === 'cron' ? cronExpr.trim() !== '' : everyN > 0,
  );

  // Multi-CTA contract (TextInput docstring): the clear button is ALWAYS
  // rendered in editable mode and owns the right edge — the assist icon
  // takes the documented SECOND slot (`right-10`) permanently, and the
  // input padding keeps both CTAs clear of the text.
  let inputPadding = $derived(!readonly && !disabled ? 'pr-16' : '');
</script>

<div class={cn('space-y-1', className)} data-testid={dataTestId}>
  <div class="relative">
    <TextInput
      {id}
      {name}
      bind:value
      {placeholder}
      {readonly}
      {disabled}
      class={inputPadding}
      data-testid="{dataTestId}-field"
      {...rest}
    >
      {#snippet trailing()}
        {#if !readonly && !disabled}
          <Popover.Root bind:open={assistOpen}>
            <Popover.Trigger>
              {#snippet child({ props: triggerProps })}
                <button
                  {...triggerProps}
                  type="button"
                  tabindex={-1}
                  aria-label={$t('app.widgets.schedule_spec.assist')}
                  title={$t('app.widgets.schedule_spec.assist')}
                  class={cn(inputTrailingIconButtonClasses, 'right-10')}
                  data-testid="{dataTestId}-assist"
                >
                  <ClipboardClock class="size-4" />
                </button>
              {/snippet}
            </Popover.Trigger>
            <Popover.Content class="w-72 space-y-3 p-3" align="end">
              <!-- Mode selector -->
              <div class="flex gap-1" data-testid="{dataTestId}-modes">
                {#each ['interval', 'once', 'cron'] as const as m (m)}
                  <Button
                    type="button"
                    variant={mode === m ? 'default' : 'outline'}
                    size="sm"
                    class="flex-1"
                    data-testid="{dataTestId}-mode-{m}"
                    onclick={() => (mode = m)}
                  >
                    {$t(`app.widgets.schedule_spec.mode.${m}`)}
                  </Button>
                {/each}
              </div>

              {#if mode === 'interval'}
                <div class="flex items-center gap-2">
                  <span class="text-sm text-muted-foreground">{$t('app.widgets.schedule_spec.every')}</span>
                  <input
                    type="number"
                    min="1"
                    bind:value={everyN}
                    class="h-8 w-20 rounded-md border-primary-gradient px-2 text-sm"
                    data-testid="{dataTestId}-every-n"
                  />
                  <select
                    bind:value={everyUnit}
                    class="h-8 rounded-md border-primary-gradient px-1 text-sm"
                    data-testid="{dataTestId}-every-unit"
                  >
                    {#each ['s', 'm', 'h', 'd'] as const as u (u)}
                      <option value={u}>{$t(`app.widgets.schedule_spec.unit.${u}`)}</option>
                    {/each}
                  </select>
                </div>
              {:else if mode === 'once'}
                <input
                  type="datetime-local"
                  bind:value={atLocal}
                  class="h-8 w-full rounded-md border-primary-gradient px-2 text-sm"
                  data-testid="{dataTestId}-at-local"
                />
              {:else}
                <input
                  type="text"
                  bind:value={cronExpr}
                  placeholder="*/5 * * * *"
                  class="h-8 w-full rounded-md border-primary-gradient px-2 font-mono text-sm"
                  data-testid="{dataTestId}-cron-expr"
                />
              {/if}

              <Button
                type="button"
                size="sm"
                class="w-full"
                disabled={!canApply}
                data-testid="{dataTestId}-apply"
                onclick={applyAssist}
              >
                {$t('app.widgets.schedule_spec.apply')}
              </Button>
            </Popover.Content>
          </Popover.Root>
        {/if}
      {/snippet}
    </TextInput>
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
            <span class="text-muted-foreground"> — {description}</span>
          {/if}
          {#if runs.length > 0}
            <div class="text-muted-foreground">
              {$t('app.widgets.schedule_spec.next')}:
              {#each runs as run, i (run.getTime())}
                {#if i > 0} · {/if}{formatUiDateTime(run, locale())}
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
