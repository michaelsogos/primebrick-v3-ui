<script lang="ts">
  /**
   * ReviveIntervalInput — composite editor for the closed `'N unit'`
   * revive-interval grammar (`parseReviveInterval` in @primebrick/core —
   * `day|week|month|quarter|year`, never a pg `interval`).
   *
   * Anatomy: one `NumericInput` (bigint, unsigned) whose trailing UoM CTA
   * opens the internal dropdown — 5 units, exactly at
   * `UOM_DROPDOWN_MAX_OPTIONS`, so no host picker sheet is needed.
   *
   *   ┌───────────────────────────────┐
   *   │ 3                        [yr] │  ← emits `value = "3 years"`
   *   └───────────────────────────────┘
   *
   * The bound `value` is the varchar canonical verbatim (`"N unit"` /
   * `"N units"`) — what the wire validator and the DB round-trip. Unit
   * labels are `app.widgets.revive_interval.unit.<unit>` keys through the
   * ui i18n bridge; the owning translations patch seeds every locale.
   */
  import { NumericInput } from '../numeric-input/index.js';
  import type { UomOption } from '../../composables/useNumericInput.svelte.js';
  import { parseReviveInterval } from '@primebrick/core';
  import { getT } from '../../bridges.js';

  const t = getT();

  /** The closed unit vocabulary — order IS the dropdown order. */
  const UNITS = ['day', 'week', 'month', 'quarter', 'year'] as const;
  type ReviveUnit = (typeof UNITS)[number];

  let {
    value = $bindable(''),
    id,
    name,
    placeholder,
    readonly = false,
    disabled = false,
    'data-testid': dataTestId = 'revive-interval-input',
    class: className,
  }: {
    /** The `'N unit'` canonical string (empty = unset). */
    value?: string;
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

  const unitOptions: UomOption[] = UNITS.map((u) => ({
    code: u,
    label_key: `app.widgets.revive_interval.unit.${u}`,
  }));

  // --- dual state: n/unit internal ↔ canonical string outward -----------
  let n = $state('');
  let unit = $state<ReviveUnit>('year');

  /** What the current n/unit pair emits — singular when n === '1'. */
  const canonical = $derived(
    n === '' ? '' : `${n} ${unit}${n === '1' ? '' : 's'}`,
  );

  // outward: internal pair → bound canonical. `lastEmitted` lets the
  // inward pass distinguish "our own emission" from an external write
  // (record load, reset) without an update loop.
  let lastEmitted = $state('');
  $effect(() => {
    lastEmitted = canonical;
    value = canonical;
  });

  // inward: external value → internal pair. Unparseable values keep the
  // internal pair untouched — the `revive_interval` format check flags
  // the stored string; destroying state on a foreign value is the bug.
  $effect(() => {
    if (value === lastEmitted) return;
    const p = value === '' ? null : parseReviveInterval(value);
    if (p) {
      n = String(p.count);
      unit = p.unit as ReviveUnit;
    } else if (value === '') {
      n = '';
    }
    lastEmitted = value;
  });
</script>

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
  data-testid={dataTestId}
  class={className}
/>
