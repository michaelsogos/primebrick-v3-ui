<script lang="ts">
  /**
   * SequenceInput — the directive editor for `format:"sequence"` columns.
   *
   * Anatomy (mirrors ScheduleSpecInput):
   *   ┌──────────────────────────────────┐
   *   │ CUST-00139                   [1›]│  ← readonly display + assist CTA
   *   ├──────────────────────────────────┤
   *   │ next: CUST-00141                 │  ← forecast strip (read-only)
   *   └──────────────────────────────────┘
   *
   * The bound value is the WIRE slot: a `SequenceDirective` once the user
   * applies one, `''`/undefined while untouched (omitted on create = the
   * column's default sequence allocates in the write tx; on update the
   * stored literal stays untouched — it renders through `existing`,
   * never through `value`). The text field is readonly BY CONSTRUCTION:
   * the wire contract rejects literal strings, so the only ways to fill
   * the slot are the two assist modes — a typed literal could only ever
   * produce a guaranteed 400.
   *
   * Modes (column-authored via `seq.modes`):
   *   - `generate` — inline pattern builder → `{seq:{pattern,step,start,sez*}}`
   *     materialized + allocated inside the write transaction;
   *   - `select` — paged/search combobox over the module's `sequence`
   *     registry → `{seq:{uuid,sez*}}` — uuid is the ONLY sequence
   *     identity (`name` is display data); the new-tab CTA opens the
   *     `/{service}/settings/sequences` dict page so a missing sequence
   *     is one tab away.
   *
   * Forecast is READ-ONLY by contract: registry list rows already carry
   * `emitted_next` for partition-free patterns; `POST /api/v1/actions/sequence-forecast`
   * resolves the value only when the picked pattern needs sezionale
   * context the list row cannot carry. The `primebrick_sequence_sync`
   * BroadcastChannel refreshes the option vocabulary when the dict tab
   * saves — a sequence authored in the new tab is selectable here
   * without a reload.
   *
   * `service` is the OWNING module code (`crm`): remote bundles resolve
   * it through the bound service-api slot, the host falls back to the
   * `/svc/<code>` proxy prefix — the builtin registry is mounted on
   * every module and the route context decides which one serves.
   */
  import TextInput from '../input/text-input.svelte';
  import * as Popover from '../popover/index.js';
  import * as Choicebox from '../choicebox/index.js';
  import Button from '../button/button.svelte';
  import Badge from '../badge/badge.svelte';
  import { NumericInput } from '../numeric-input/index.js';
  import ComboSelect from '../combo-select/combo-select.svelte';
  import { getT, getServiceApi, type ServiceApiFn } from '../../bridges.js';
  import { cn } from '../../utils/index.js';
  import { CircleAlert, CircleCheck } from '@primebrick/ui/vendor/lucide';
  import { onMount } from 'svelte';
  import {
    extJsonParse,
    extJsonStringify,
    parseSequencePattern,
    renderSequenceValue,
    type SequenceDecl,
    type SequenceDirective,
    type SequenceDirectiveContext,
    type SequenceMode,
    type SequencePattern,
    type SequenceSezToken,
  } from '@primebrick/core';
  import type { HTMLInputAttributes } from 'svelte/elements';

  const t = getT();

  const SEZ_SLOTS: readonly SequenceSezToken[] = ['sez', 'sez2', 'sez3'];
  const PAGE_SIZE = 50;
  const SEARCH_DEBOUNCE_MS = 350;

  /** One registry row as served by `entities/sequence/list`. */
  interface SequenceRow {
    uuid: string;
    name: string;
    pattern: string;
    step?: bigint | number | string;
    start?: bigint | number | string;
    tz?: string | null;
    /** i18n key for the explanatory description — the option tooltip. */
    description_key?: string | null;
    /** `attachCounterProjection` — the next emitted value on the default
     *  partition at now; `null` when the pattern needs sez context. */
    emitted_next?: string | null;
  }

  interface SeqOption extends Record<string, unknown> {
    value: string;
    label: string;
    _desc?: string;
    _sub?: string;
    _raw: SequenceRow;
  }

  /** The column-authored `seq` block on `MetaColumn` (see entity-meta). */
  export interface SequenceInputSeqDecl {
    /** DERIVED default sequence identity — deterministic bound uuid. */
    uuid?: string;
    /** DERIVED bound name — `<table>.<field>` (display only). */
    name?: string;
    modes?: readonly SequenceMode[];
    default_mode?: SequenceMode;
    allow_create?: boolean;
  }

  let {
    value = $bindable(),
    existing,
    seq,
    service,
    id,
    name,
    placeholder,
    readonly = false,
    disabled = false,
    'data-testid': dataTestId = 'sequence-input',
    class: className,
    ...rest
  }: {
    /** The wire slot — `SequenceDirective` once applied; `''`/undefined
     *  while untouched (auto). Never a literal. */
    value?: SequenceDirective | '' | undefined;
    /** The record's stored literal on update surfaces — display context
     *  only, it never travels back through `value`. */
    existing?: string;
    /** The column's `seq` block — bound identity (uuid) + authored modes. */
    seq?: SequenceInputSeqDecl;
    /** Owning module code (`crm`) — resolves the module-local builtin
     *  registry through the service-api bridge (remote) or the
     *  `/svc/<code>` proxy prefix (host). */
    service?: string;
    id?: string;
    name?: string;
    placeholder?: string;
    readonly?: boolean;
    disabled?: boolean;
    'data-testid'?: string;
    class?: string;
  } & Omit<HTMLInputAttributes, 'value' | 'readonly' | 'disabled' | 'placeholder' | 'class' | 'type'> = $props();

  const modes = $derived.by<SequenceMode[]>(() => {
    const authored = seq?.modes?.filter((m): m is SequenceMode => m === 'generate' || m === 'select');
    return authored && authored.length > 0 ? authored : ['generate', 'select'];
  });
  const defaultMode = $derived<SequenceMode>(
    seq?.default_mode && modes.includes(seq.default_mode) ? seq.default_mode : modes[0],
  );
  const allowCreate = $derived(seq?.allow_create !== false);

  // --- Service-api resolution ------------------------------------------
  // Remote bundles bind `ctx.api` under the module code; the host binds
  // only 'host' — the same builtin registry rides the `/svc/<code>`
  // proxy there. A BE-owned column (no service) takes the direct path.
  function serviceApi(): ServiceApiFn {
    if (service) {
      try {
        return getServiceApi(service);
      } catch {
        const host = getServiceApi('host');
        return (path, init) => host(`/svc/${service}${path}`, init);
      }
    }
    return getServiceApi('host');
  }

  // --- Select-mode option vocabulary ------------------------------------
  let seqOptions = $state<SeqOption[]>([]);
  let optLoading = $state(false);
  let optLoadingMore = $state(false);
  let optTotal = $state(0);
  let optPage = 1;
  let optSearch = '';
  let optSeq = 0;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  function mapSeqRows(rows: SequenceRow[]): SeqOption[] {
    return rows.map((row) => ({
      value: row.uuid,
      label: row.name,
      _desc: row.description_key ? $t(row.description_key) : row.pattern,
      _sub: row.emitted_next ?? row.pattern,
      _raw: row,
    }));
  }

  async function fetchSeqPage(page: number, search: string, append: boolean) {
    const mySeq = ++optSeq;
    if (append) optLoadingMore = true;
    else optLoading = true;
    try {
      const qs = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (search) qs.set('search', search);
      const res = await serviceApi()(`/api/v1/entities/sequence/list?${qs.toString()}`);
      if (!res.ok || mySeq !== optSeq) return;
      const data = extJsonParse<{ rows?: SequenceRow[]; total?: number | bigint }>(await res.text());
      const mapped = mapSeqRows(data.rows ?? []);
      seqOptions = append ? [...seqOptions, ...mapped] : mapped;
      optTotal = Number(data.total ?? 0);
      optPage = page;
    } catch {
      // silent degradation — the combobox keeps what it has
    } finally {
      if (mySeq === optSeq) {
        optLoading = false;
        optLoadingMore = false;
      }
    }
  }

  function onSelectSearch(q: string) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      optSearch = q.trim();
      void fetchSeqPage(1, optSearch, false);
    }, SEARCH_DEBOUNCE_MS);
  }

  function onSelectLoadMore() {
    if (optLoading || optLoadingMore || seqOptions.length >= optTotal) return;
    void fetchSeqPage(optPage + 1, optSearch, true);
  }

  // The dict tab saves → the option vocabulary refetches (same-tab AND
  // cross-tab — BroadcastChannel reaches the dict page opened beside).
  onMount(() => {
    const ch = new BroadcastChannel('primebrick_sequence_sync');
    ch.onmessage = (ev) => {
      if (ev.data === 'refresh' && seqOptions.length > 0) {
        void fetchSeqPage(1, optSearch, false);
      }
    };
    return () => ch.close();
  });

  // --- Assist builder ----------------------------------------------------
  let assistOpen = $state(false);
  let mode = $state<SequenceMode>('generate');
  // generate-mode fields (strings — NumericInput's canonical wire).
  let genPattern = $state('');
  let genStep = $state('1');
  let genStart = $state('1');
  let genSez = $state<Record<SequenceSezToken, string>>({ sez: '', sez2: '', sez3: '' });
  // select-mode fields
  let selUuid = $state('');
  let selSez = $state<Record<SequenceSezToken, string>>({ sez: '', sez2: '', sez3: '' });

  const genParsed = $derived.by<SequencePattern | null>(() => {
    try {
      return parseSequencePattern(genPattern);
    } catch {
      return null;
    }
  });
  const genParseError = $derived.by(() => {
    if (genPattern.trim() === '') return null;
    try {
      parseSequencePattern(genPattern);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  });

  const selRow = $derived(seqOptions.find((o) => o.value === selUuid)?._raw);
  const selParsed = $derived.by<SequencePattern | null>(() => {
    if (!selRow) return null;
    try {
      return parseSequencePattern(selRow.pattern);
    } catch {
      return null;
    }
  });
  const selParseError = $derived.by(() => {
    if (!selRow) return null;
    try {
      parseSequencePattern(selRow.pattern);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  });

  function sezComplete(pattern: SequencePattern, parts: Record<SequenceSezToken, string>): boolean {
    return pattern.sez_slots.every((slot) => (parts[slot] ?? '').trim() !== '');
  }

  function sezCtx(pattern: SequencePattern, parts: Record<SequenceSezToken, string>): SequenceDirectiveContext {
    const ctx: SequenceDirectiveContext = {};
    for (const slot of SEZ_SLOTS) {
      const v = parts[slot]?.trim();
      if (v && pattern.sez_slots.includes(slot)) ctx[slot] = v;
    }
    return ctx;
  }

  function validBigInt(s: string): boolean {
    try {
      BigInt(s.trim());
      return s.trim() !== '';
    } catch {
      return false;
    }
  }

  const canApply = $derived.by(() => {
    if (mode === 'generate') {
      if (!genParsed || !validBigInt(genStep) || !validBigInt(genStart)) return false;
      if (BigInt(genStep.trim()) === 0n) return false;
      return sezComplete(genParsed, genSez);
    }
    if (!selUuid) return false;
    if (selRow && !selParsed) return false; // corrupt registry pattern
    return selParsed ? sezComplete(selParsed, selSez) : true;
  });

  /** Seed the builders from the current directive each time the popover
   *  opens — one wire value, two ways to fill it (the schedule-spec
   *  convention this anatomy mirrors). Edge-guarded: re-running on
   *  seqOptions/optLoading landing mid-interaction would nuke the user's
   *  mode choice back to default. */
  let prevAssistOpen = false;
  $effect(() => {
    const opening = assistOpen && !prevAssistOpen;
    prevAssistOpen = assistOpen;
    if (opening) {
      seedFromValue();
      if (seqOptions.length === 0 && !optLoading) void fetchSeqPage(1, '', false);
    }
  });

  function seedFromValue() {
    const v = value;
    if (v && typeof v === 'object' && 'seq' in v) {
      const s = v.seq;
      if (s && typeof s === 'object' && 'pattern' in s && modes.includes('generate')) {
        mode = 'generate';
        genPattern = String(s.pattern ?? '');
        genStep = String(s.step ?? '1');
        genStart = String(s.start ?? '1');
        genSez = pickSez(s);
      } else if (modes.includes('select')) {
        mode = 'select';
        selUuid = typeof s === 'string' ? s : String((s as { uuid?: string }).uuid ?? '');
        selSez = pickSez(s);
      } else {
        mode = defaultMode;
      }
    } else {
      mode = defaultMode;
    }
  }

  function pickSez(s: unknown): Record<SequenceSezToken, string> {
    const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
    return {
      sez: typeof o.sez === 'string' ? o.sez : '',
      sez2: typeof o.sez2 === 'string' ? o.sez2 : '',
      sez3: typeof o.sez3 === 'string' ? o.sez3 : '',
    };
  }

  function applyAssist() {
    if (mode === 'generate' && genParsed) {
      const decl: SequenceDecl = {
        pattern: genPattern.trim(),
        step: BigInt(genStep.trim()),
        start: BigInt(genStart.trim()),
      };
      value = { seq: { ...decl, ...sezCtx(genParsed, genSez) } };
    } else if (mode === 'select' && selUuid) {
      value = {
        seq: { uuid: selUuid, ...(selParsed ? sezCtx(selParsed, selSez) : {}) },
      };
    }
    assistOpen = false;
  }

  function resetToAuto() {
    value = '';
    assistOpen = false;
  }

  // --- Display + forecast strip ------------------------------------------
  const directive = $derived.by<SequenceDirective | null>(() =>
    value && typeof value === 'object' && 'seq' in value ? (value as SequenceDirective) : null,
  );

  const displayValue = $derived.by(() => {
    const d = directive;
    if (d) {
      const s = d.seq;
      if (typeof s === 'string') return seqOptions.find((o) => o.value === s)?.label ?? s;
      if ('uuid' in s && s.uuid) return seqOptions.find((o) => o.value === s.uuid)?.label ?? s.uuid;
      if ('pattern' in s) {
        try {
          const p = parseSequencePattern(s.pattern);
          return renderSequenceValue(p, BigInt(s.start), new Date(), {
            partitions: pickSez(s),
          });
        } catch {
          return s.pattern;
        }
      }
    }
    return existing ?? '';
  });

  const autoPlaceholder = $derived(
    placeholder ?? (seq?.name ? $t('app.widgets.sequence.auto_of', { code: seq.name }) : $t('app.widgets.sequence.auto')),
  );

  // Forecast strip — the value the NEXT claim emits for the effective
  // resolution. Local render for expr directives; the registry row's
  // `next` for select picks; the forecast RPC only when the resolution
  // needs context neither carries (partitioned pattern with sez filled,
  // or the column's default code in the auto state).
  let stripNext = $state<string | null>(null);
  let stripErr = $state(false);
  let stripSeq = 0;

  const exprPreview = $derived.by(() => {
    const s = directive?.seq;
    if (s && typeof s === 'object' && 'pattern' in s) {
      try {
        const p = parseSequencePattern(s.pattern);
        return renderSequenceValue(p, BigInt(s.start), new Date(), {
          partitions: pickSez(s),
        });
      } catch {
        return null;
      }
    }
    return null;
  });

  /** Forecast target: the applied directive's sequence uuid, else the
   *  column's bound uuid while the field stays untouched. `null` while a
   *  stored literal is shown — the next emission is not the question an
   *  unchanged field asks. */
  const forecastIdentity = $derived.by<{ uuid: string; sez?: SequenceDirectiveContext } | null>(
    () => {
      const s = directive?.seq;
      if (typeof s === 'string' && s) {
        return { uuid: s };
      }
      if (s && typeof s === 'object' && 'uuid' in s && s.uuid) {
        const parts = pickSez(s);
        const hasSez = SEZ_SLOTS.some((slot) => parts[slot] !== '');
        return {
          uuid: s.uuid,
          sez: hasSez ? (parts as SequenceDirectiveContext) : undefined,
        };
      }
      if (!directive && !existing && seq?.uuid) return { uuid: seq.uuid };
      return null;
    },
  );

  $effect(() => {
    const target = forecastIdentity;
    const mySeq = ++stripSeq;
    if (!target) {
      stripNext = null;
      stripErr = false;
      return;
    }
    stripErr = false;
    // A registry row's own `emitted_next` answers without a call when the
    // directive names a loaded sequence on the default partition.
    if (!target.sez) {
      const row = seqOptions.find((o) => o.value === target.uuid)?._raw;
      if (row?.emitted_next) {
        stripNext = row.emitted_next;
        return;
      }
    }
    const body: Record<string, unknown> = { uuid: target.uuid, ...(target.sez ?? {}) };
    serviceApi()('/api/v1/actions/sequence-forecast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: extJsonStringify(body),
    })
      .then(async (res) => {
        if (mySeq !== stripSeq) return;
        if (!res.ok) {
          stripNext = null;
          stripErr = true;
          return;
        }
        const data = extJsonParse<{ next?: string | null }>(await res.text());
        stripNext = data.next ?? null;
      })
      .catch(() => {
        if (mySeq === stripSeq) {
          stripNext = null;
          stripErr = true;
        }
      });
  });

  const shownNext = $derived(exprPreview ?? stripNext);
  const hasDirective = $derived(directive !== null);

  let inputWrap: HTMLElement | undefined = $state();
</script>

<div class={cn('space-y-1', className)} data-testid={dataTestId}>
  <div class="relative" bind:this={inputWrap}>
    <Popover.Root bind:open={assistOpen}>
      <TextInput
        {id}
        {name}
        value={displayValue}
        placeholder={autoPlaceholder}
        readonly={true}
        {disabled}
        data-testid="{dataTestId}-field"
        trailing_ctas={!readonly && !disabled
          ? [{
              icon: 'sequence-numeric-right',
              label: $t('app.widgets.sequence.assist'),
              onclick: () => (assistOpen = true),
              'data-testid': `${dataTestId}-assist`,
            }]
          : undefined}
        {...rest}
      />
      <Popover.Content class="w-96 space-y-3 p-3" align="end" customAnchor={inputWrap}>
        <!-- Mode selector — the selected card hosts its own builder; a
             single authored mode collapses the choice chrome entirely. -->
        {#if modes.length > 1}
          <Choicebox.Root
            value={mode}
            onValueChange={(v) => (mode = v as SequenceMode)}
            name="sequence-mode"
            data-testid="{dataTestId}-modes"
          >
            {#if modes.includes('generate')}
              <Choicebox.Item value="generate" data-testid="{dataTestId}-mode-generate">
                <Choicebox.Title>{$t('app.widgets.sequence.mode.generate')}</Choicebox.Title>
                <Choicebox.Description>{$t('app.widgets.sequence.mode.generate.desc')}</Choicebox.Description>
                <Choicebox.Indicator />
                {#if mode === 'generate'}
                  {@render generateBuilder()}
                {/if}
              </Choicebox.Item>
            {/if}
            {#if modes.includes('select')}
              <Choicebox.Item value="select" data-testid="{dataTestId}-mode-select">
                <Choicebox.Title>{$t('app.widgets.sequence.mode.select')}</Choicebox.Title>
                <Choicebox.Description>{$t('app.widgets.sequence.mode.select.desc')}</Choicebox.Description>
                <Choicebox.Indicator />
                {#if mode === 'select'}
                  {@render selectBuilder()}
                {/if}
              </Choicebox.Item>
            {/if}
          </Choicebox.Root>
        {:else if modes[0] === 'generate'}
          {@render generateBuilder()}
        {:else}
          {@render selectBuilder()}
        {/if}

        <div class="-mx-3 -mb-3 flex items-center justify-between gap-2 border-t bg-muted/50 px-3 py-2">
          <div>
            {#if hasDirective}
              <Button
                type="button"
                variant="ghost"
                size="xs"
                data-testid="{dataTestId}-reset"
                onclick={resetToAuto}
              >
                {$t('app.widgets.sequence.reset_auto')}
              </Button>
            {:else}
              <span></span>
            {/if}
          </div>
          <Button
            type="button"
            size="xs"
            disabled={!canApply}
            data-testid="{dataTestId}-apply"
            onclick={applyAssist}
          >
            {$t('app.widgets.sequence.apply')}
          </Button>
        </div>
      </Popover.Content>
    </Popover.Root>
  </div>

  <!-- Forecast strip -->
  {#if shownNext !== null || stripErr}
    <div class="flex items-start gap-1.5 px-1 text-xs" data-testid="{dataTestId}-strip">
      {#if stripErr}
        <CircleAlert class="mt-0.5 size-3.5 shrink-0 text-destructive" />
        <span class="text-destructive">{$t('app.widgets.sequence.forecast_failed')}</span>
      {:else}
        <CircleCheck class="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
        <span class="text-muted-foreground">{$t('app.widgets.sequence.next')}:</span>
        <Badge variant="secondary" class="font-normal" data-testid="{dataTestId}-next">{shownNext}</Badge>
      {/if}
    </div>
  {/if}
</div>

{#snippet generateBuilder()}
  <div class="space-y-2 pt-3">
    <TextInput
      bind:value={genPattern}
      placeholder={$t('app.widgets.sequence.pattern_hint')}
      data-testid="{dataTestId}-pattern"
    />
    {#if genParseError}
      <p class="text-xs text-destructive" data-testid="{dataTestId}-pattern-error">{genParseError}</p>
    {/if}
    <div class="flex items-center gap-2">
      <span class="shrink-0 text-sm text-muted-foreground">{$t('app.widgets.sequence.step')}</span>
      <div class="min-w-0 flex-1">
        <NumericInput kind="bigint" steppers={false} bind:value={genStep} data-testid="{dataTestId}-step" />
      </div>
      <span class="shrink-0 text-sm text-muted-foreground">{$t('app.widgets.sequence.start')}</span>
      <div class="min-w-0 flex-1">
        <NumericInput kind="bigint" steppers={false} bind:value={genStart} data-testid="{dataTestId}-start" />
      </div>
    </div>
    {#if genParsed && genParsed.sez_slots.length > 0}
      <div class="flex items-center gap-2">
        {#each genParsed.sez_slots as slot (slot)}
          <TextInput
            bind:value={genSez[slot]}
            placeholder={$t(`app.widgets.sequence.sez_${slot}`)}
            data-testid="{dataTestId}-sez-{slot}"
          />
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet selectBuilder()}
  <div class="space-y-2 pt-3">
    <ComboSelect
      mode="single"
      bind:value={selUuid}
      options={seqOptions}
      valueField="value"
      labelField="label"
      descriptionField="_desc"
      secondaryField="_sub"
      display="detailed"
      onSearchInput={onSelectSearch}
      onLoadMore={onSelectLoadMore}
      loading={optLoading}
      loadingMore={optLoadingMore}
      placeholder={$t('app.widgets.sequence.select_hint')}
      data-testid="{dataTestId}-select"
    />
    {#if allowCreate && service}
      <Button
        type="button"
        variant="ghost"
        size="xs"
        class="w-full justify-start"
        data-testid="{dataTestId}-new"
        onclick={() => window.open(`/${service}/settings/sequences`, '_blank')}
      >
        {$t('app.widgets.sequence.create_new')}
      </Button>
    {/if}
    {#if selParseError}
      <p class="text-xs text-destructive" data-testid="{dataTestId}-select-error">{selParseError}</p>
    {/if}
    {#if selParsed && selParsed.sez_slots.length > 0}
      <div class="flex items-center gap-2">
        {#each selParsed.sez_slots as slot (slot)}
          <TextInput
            bind:value={selSez[slot]}
            placeholder={$t(`app.widgets.sequence.sez_${slot}`)}
            data-testid="{dataTestId}-select-sez-{slot}"
          />
        {/each}
      </div>
    {/if}
  </div>
{/snippet}
