<script lang="ts">
  /**
   * ReviveIntervalInput — composite editor for the revive spec grammar
   * (`parseReviveSpec`/`parseGraceSpec` in @primebrick/core):
   *
   *   - interval mode: the closed `'N unit'` cadence (`day|week|month|
   *     quarter|year`, never a pg `interval`) — `NumericInput` + the
   *     5-unit internal dropdown on the trailing UoM CTA;
   *   - literal mode: an explicit instant — `'at <RFC3339>'` pins
   *     `expire_at`, `'until <RFC3339>'` pins `switch_at`. The axis picks
   *     the keyword via the `literal` prop (`revive_interval` → `at`,
   *     `revive_offset` → `until`). Rendered through `DateWheelPicker`
   *     (`includeTime`) — the emitted instant is absolute RFC3339.
   *
   *   ┌───────────────────────────────┐
   *   │ [Ogni] 3                [yr] │  ← emits `value = "3 years"`
   *   │ [Il]   16 giu 2027, 00:00 📅 │  ← emits `value = "at 2027-06-16T…"`
   *   └───────────────────────────────┘
   *
   * The bound `value` is the varchar canonical verbatim — what the wire
   * validator and the DB round-trip. Unit/mode labels are
   * `app.widgets.revive_interval.*` keys through the ui i18n bridge.
   */
  import { NumericInput } from '../numeric-input/index.js';
  import type { UomOption } from '../../composables/useNumericInput.svelte.js';
  import { DateWheelPicker } from '../date-dropper/index.js';
  import Button from '../button/button.svelte';
  import {
    parseReviveSpec,
    parseGraceSpec,
    type ReviveSpec,
  } from '@primebrick/core';
  import { CalendarDateTime, getLocalTimeZone } from '@internationalized/date';
  import { getT } from '../../bridges.js';
  import { cn } from '../../utils/index.js';

  const t = getT();

  /** The closed unit vocabulary — order IS the dropdown order. */
  const UNITS = ['day', 'week', 'month', 'quarter', 'year'] as const;
  type ReviveUnit = (typeof UNITS)[number];

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
    // Explicit props only — NumericInput re-declares the native input
    // attributes with narrower (`| undefined`, no `| null`) types, so a
    // rest-spread of `HTMLInputAttributes` can never typecheck. This is a
    // composite control, not an `<input>`: passthrough attrs aren't a
    // contract here.
  } = $props();

  /** Axis-bound spec parser — `at` literals on the every axis,
   *  `until` on the grace axis. */
  const parseSpec = (s: string): ReviveSpec | null =>
    literal === 'at' ? parseReviveSpec(s) : parseGraceSpec(s);

  const unitOptions: UomOption[] = UNITS.map((u) => ({
    code: u,
    label_key: `app.widgets.revive_interval.unit.${u}`,
  }));

  // --- dual state: (mode, n|at, unit) ↔ canonical string outward --------
  let mode = $state<'interval' | 'literal'>('interval');
  let n = $state('');
  let unit = $state<ReviveUnit>('year');
  let atValue = $state<CalendarDateTime | null>(null);
  let atTz = $state('');

  // Seed all slots from the INITIAL bound value: the outward $effect
  // emits `canonical` on its first run — with empty state it would
  // clobber a mount-time value (view/update modes bind the stored row
  // before the first effect tick). Seeded, that first emission is
  // idempotent.
  const seed = value === '' ? null : parseSpec(value);
  if (seed?.kind === 'interval') {
    n = String(seed.count);
    unit = seed.unit as ReviveUnit;
  } else if (seed?.kind === 'at') {
    mode = 'literal';
    const d = seed.at;
    atValue = new CalendarDateTime(
      d.getFullYear(), d.getMonth() + 1, d.getDate(),
      d.getHours(), d.getMinutes(), d.getSeconds(),
    );
  }

  /** What the active mode emits — singular when n === '1'; the literal
   *  keyword is the axis-bound `literal` prop. Empty state emits ''. */
  const canonical = $derived(
    mode === 'interval'
      ? n === '' ? '' : `${n} ${unit}${n === '1' ? '' : 's'}`
      : atValue === null
        ? ''
        : `${literal} ${atValue.toDate(atTz || getLocalTimeZone()).toISOString()}`,
  );

  // outward: internal state → bound canonical. `lastEmitted` lets the
  // inward pass distinguish "our own emission" from an external write
  // (record load, reset) without an update loop.
  let lastEmitted = $state('');
  $effect(() => {
    lastEmitted = canonical;
    value = canonical;
  });

  // inward: external value → internal state. Unparseable values keep the
  // slots untouched — the spec format check flags the stored string;
  // destroying state on a foreign value is the bug.
  $effect(() => {
    if (value === lastEmitted) return;
    const p = value === '' ? null : parseSpec(value);
    if (p?.kind === 'interval') {
      mode = 'interval';
      n = String(p.count);
      unit = p.unit as ReviveUnit;
    } else if (p?.kind === 'at') {
      mode = 'literal';
      const d = p.at;
      atValue = new CalendarDateTime(
        d.getFullYear(), d.getMonth() + 1, d.getDate(),
        d.getHours(), d.getMinutes(), d.getSeconds(),
      );
    } else if (value === '') {
      n = '';
      atValue = null;
    }
    lastEmitted = value;
  });
</script>

<div class={cn('flex items-center gap-1.5', className)} data-testid={dataTestId}>
  {#if !readonly && !disabled}
    <Button
      type="button"
      variant="ghost"
      size="xs"
      class="shrink-0 px-2"
      onclick={() => (mode = mode === 'interval' ? 'literal' : 'interval')}
      data-testid="{dataTestId}-mode"
      title={$t(`app.widgets.revive_interval.mode.${mode === 'interval' ? 'every' : literal}`)}
    >
      {$t(`app.widgets.revive_interval.mode.${mode === 'interval' ? 'every' : literal}`)}
    </Button>
  {/if}
  {#if mode === 'interval'}
    <NumericInput
      kind="bigint"
      unsigned={true}
      steppers={false}
      bind:value={n}
      uom={{
        kind: 'custom',
        code: unit,
        options: unitOptions,
        on_uom_change: (c) => (unit = c as ReviveUnit),
      }}
      {id}
      {name}
      {placeholder}
      {readonly}
      {disabled}
      data-testid="{dataTestId}-field"
    />
  {:else}
    <!-- DateWheelPicker has no readonly prop — view mode maps to disabled
         (the stored literal still renders; the popover stays shut). -->
    <DateWheelPicker
      bind:value={atValue}
      bind:timezone={atTz}
      includeTime={true}
      {placeholder}
      disabled={disabled || readonly}
      {id}
      dataTestId="{dataTestId}-at"
    />
  {/if}
</div>
