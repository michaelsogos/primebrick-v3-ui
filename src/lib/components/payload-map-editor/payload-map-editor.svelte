<script lang="ts">
  /**
   * PayloadMapEditor — the structured builder for a rule's `payload_map`
   * DST (declared contract in `@primebrick/core`, v2 model).
   *
   * Anatomy (the entity-form standard — same composition as the config
   * entry builder): one row per field of the TARGET callable's
   * `payload_schema` on top, the shared `JsonValueEditor` for the raw DST
   * document at the bottom. Both write the same `value` JSON text —
   * schema-driven rows for the common case, raw editing for the rest;
   * edits in either surface re-render the other.
   *
   * The editor shape is DISPATCHED on the field's declared schema —
   * end users pick "where the value comes from", never DST jargon:
   *   - `type:"array"`  → `list` — "Elenco di valori": element-by-element,
   *                       each item its own source (`+ Aggiungi valore`)
   *   - `type:"object"` → `map` — "Per chiave": one row per key, suggested
   *                       keys from `x_map_keys` (template `variables`)
   *   - scalar          → leaf sources: `const` "Valore fisso",
   *                       `path` "Proprietà del messaggio evento",
   *                       `meta` "Contesto del processo"
   *
   * `inject` is DECLARATION-ONLY — it materializes via `x_inject` /
   * `x_semantic` schema annotations (seeding lives in the host's data
   * assembly via `seedPayloadMapEntries`, never a widget side-effect);
   * it appears in the picker only to DISPLAY an already-declared entry.
   *
   * Fallback is a property OF the value — never a kind: any entry carries
   * an optional `fallback` clause list rendered as readable sentences
   * ("altrimenti, se il valore è nullo o vuoto, usa…") via the
   * "+ Aggiungi riserva" CTA. Empty = null/undefined/""/[]/{}.
   *
   * Reserved fields (`x_not_editable`) never render a row — their
   * declared values materialize in the JSON document only.
   *
   * Ordering: required fields first (alphabetical), then optional fields
   * (alphabetical) inside a default-closed accordion.
   *
   * Labels are `app.widgets.payload_map.*` keys through the ui i18n
   * bridge — the owning translations patch seeds them for every locale.
   */
  import type {
    PayloadMap,
    PayloadMapEntry,
    PayloadMapItemEntry,
    PayloadMapLeafEntry,
    PayloadMapFallbackClause,
    PayloadMapMeta,
    PayloadInjector,
    PayloadOptionsSource,
    PayloadMapKeysHint,
  } from '@primebrick/core';
  import {
    PAYLOAD_MAP_META_KINDS,
    PAYLOAD_INJECTORS,
    PAYLOAD_X_MAP_KEYS,
    PAYLOAD_X_NOT_EDITABLE,
    PAYLOAD_X_OPTIONS,
  } from '@primebrick/core';
  import TextInput from '../input/text-input.svelte';
  import ComboSelect from '../combo-select/combo-select.svelte';
  import JsonValueEditor from '../json-value-editor/json-value-editor.svelte';
  import DynamicIcon from '../dynamic-icon/DynamicIcon.svelte';
  import FormLabelWithPriorityHelp from '../forms/FormLabelWithPriorityHelp.svelte';
  import * as Accordion from '../accordion/index.js';
  import { getT } from '../../bridges.js';
  import { cn } from '../../utils/index.js';

  const t = getT();

  interface JsonSchema {
    type?: string;
    description?: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    enum?: unknown[];
    items?: JsonSchema;
    [k: string]: unknown;
  }

  /** Option row resolved for an `x_options` field — `_raw` carries the
   *  source row so `x_map_keys` hints can read declared props (e.g. a
   *  template's `variables`). */
  type ResolvedOption = {
    value: string;
    label: string;
    _desc?: string;
    _sub?: string;
    _raw?: Record<string, unknown>;
    [k: string]: unknown;
  };

  let {
    value = $bindable(''),
    target_schema,
    source_schema,
    source_entity,
    options_resolver,
    readonly = false,
    disabled = false,
    on_ai_assist,
    ai_label,
    extra_completions,
    class: className,
    ...rest
  }: {
    /** The `payload_map` DST as user-authored JSON text (bindable). */
    value?: string;
    /** The selected callable's `payload_schema` — drives the field rows. */
    target_schema?: Record<string, unknown>;
    /** The source event's `payload_schema` — feeds the path picker. */
    source_schema?: Record<string, unknown>;
    /** The source emit's declared `entity` pointer (`{key,entity,table}`)
     *  — kept for contract parity with the host's seeding helper. */
    source_entity?: { key: string; entity: string; table: string };
    /** Host-injected fetcher for `x_options` fields — resolves api_url
     *  sources through the host's transport and built-in values_source
     *  lists (e.g. `locales`). */
    options_resolver?: (src: PayloadOptionsSource) => Promise<ResolvedOption[]>;
    readonly?: boolean;
    disabled?: boolean;
    /** Host-injected AI-assist opener for the raw JSON editor. */
    on_ai_assist?: () => void;
    ai_label?: string;
    /** Forwarded to the inner JsonValueEditor — data-aware completions
     *  (dot-paths for `path`/`field` values, candidates for `value`). */
    extra_completions?: ((context: {
      pos: number;
      explicit: boolean;
      state: import('@codemirror/state').EditorState;
    }) => unknown)[];
  } & import('svelte/elements').HTMLAttributes<HTMLDivElement> = $props();

  const targetSchema = $derived(target_schema as JsonSchema | undefined);
  const sourceSchema = $derived(source_schema as JsonSchema | undefined);

  /** Current DST document — unparseable text degrades to empty rows. */
  const map = $derived.by((): PayloadMap => {
    try {
      const parsed = JSON.parse(value || 'null');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as PayloadMap)
        : {};
    } catch {
      return {};
    }
  });

  const requiredSet = $derived(new Set(targetSchema?.required ?? []));

  function isNotEditable(prop: JsonSchema): boolean {
    return prop[PAYLOAD_X_NOT_EDITABLE] === true;
  }

  /** Required fields first (alphabetical), optional tail alphabetical —
   *  folded inside a default-closed accordion. `x_not_editable` fields
   *  never render a row (platform-owned setter). */
  const requiredFields = $derived(
    Object.entries(targetSchema?.properties ?? {})
      .filter(([f, p]) => requiredSet.has(f) && !isNotEditable(p))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  const optionalFields = $derived(
    Object.entries(targetSchema?.properties ?? {})
      .filter(([f, p]) => !requiredSet.has(f) && !isNotEditable(p))
      .sort(([a], [b]) => a.localeCompare(b)),
  );

  /** The user has a task when mappable rows exist OR authored entries
   *  survive in the document (schema-less leftovers they must be able to
   *  review/clean). Otherwise the editor collapses into the info empty
   *  state — no user input means no JSON editor. */
  const has_user_task = $derived(
    requiredFields.length + optionalFields.length > 0 || Object.keys(map).length > 0,
  );

  /** `$.a.b.c` paths through the source event schema, depth ≤ 5 — the
   *  navigable suggestion list (type-ahead narrows it). */
  const pathOptions = $derived.by(() => {
    const out: { value: string; label: string; _sub?: string }[] = [];
    const walk = (schema: JsonSchema | undefined, prefix: string, depth: number) => {
      if (!schema?.properties || depth > 5) return;
      for (const [key, sub] of Object.entries(schema.properties)) {
        const path = `${prefix}.${key}`;
        out.push({ value: path, label: path, _sub: sub.type });
        walk(sub, path, depth + 1);
      }
    };
    walk(sourceSchema, '$', 1);
    return out;
  });

  /**
   * Write one field's entry back into the DST text. Keys the map never
   * declared (unmapped fields, foreign keys the user hand-wrote in JSON
   * mode) are preserved verbatim — the builder never loses raw edits.
   */
  function writeEntry(field: string, entry: PayloadMapEntry | undefined): void {
    const next: Record<string, unknown> = { ...(map as Record<string, unknown>) };
    if (entry === undefined) delete next[field];
    else next[field] = entry;
    value = Object.keys(next).length === 0 ? '' : JSON.stringify(next, null, 2);
  }

  function entryOf(field: string): PayloadMapEntry | undefined {
    const e = map[field];
    return e && typeof e === 'object' && 'kind' in e ? e : undefined;
  }

  /** `entry.fallback` is preserved across source-kind switches — the
   *  declared clauses belong to the VALUE, not to the picked source. */
  function fallbackOf(entry: PayloadMapEntry | PayloadMapItemEntry | undefined) {
    return entry && 'fallback' in entry ? entry.fallback : undefined;
  }

  // ─── x_options resolution (const-value catalogs) ──────────────────────

  /** Options per field declaring `x_options`, resolved by the host. */
  let optionsCache = $state<Record<string, ResolvedOption[]>>({});

  $effect(() => {
    if (!options_resolver) return;
    for (const [field, prop] of Object.entries(targetSchema?.properties ?? {})) {
      const src = prop[PAYLOAD_X_OPTIONS] as PayloadOptionsSource | undefined;
      if (!src || optionsCache[field]) continue;
      void options_resolver(src).then((opts) => {
        optionsCache = { ...optionsCache, [field]: opts };
      });
    }
  });

  /** `_raw` row of the currently-selected option for `field` — feeds
   *  `x_map_keys` suggestions on sibling `map` fields. */
  function selectedOptionRaw(field: string): Record<string, unknown> | undefined {
    const entry = entryOf(field);
    if (entry?.kind !== 'const' || typeof entry.value !== 'string') return undefined;
    return optionsCache[field]?.find((o) => o.value === entry.value)?._raw;
  }

  /** `x_map_keys.from` dependency — the suggested keys exist only once the
   *  sibling `from` field holds a CONST value (e.g. a chosen template). Any
   *  other source can't be resolved at design time → the row's key picker
   *  and key rows stay disabled and the hint names the blocking field. */
  function mapBlockedFrom(prop: JsonSchema): string | null {
    const hint = prop[PAYLOAD_X_MAP_KEYS] as PayloadMapKeysHint | undefined;
    if (!hint?.from) return null;
    const dep = entryOf(hint.from);
    return dep?.kind === 'const' && dep.value !== '' && dep.value !== undefined ? null : hint.from;
  }

  /** Suggested keys for a `kind:"map"` field — `x_map_keys:{from,prop}`
   *  reads the selected option's row prop (e.g. the chosen template's
   *  `variables` declaration). */
  function mapKeyOptions(prop: JsonSchema): { value: string; label: string }[] {
    const hint = prop[PAYLOAD_X_MAP_KEYS] as PayloadMapKeysHint | undefined;
    if (!hint) return [];
    const raw = selectedOptionRaw(hint.from)?.[hint.prop];
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return [];
    return Object.keys(raw as Record<string, unknown>).map((k) => ({ value: k, label: k }));
  }

  // ─── Kind dispatch — the field's declared shape picks the editor ─────

  type KindOption = {
    value: string;
    label: string;
    [k: string]: unknown;
  };

  /** Declarative icon per source kind — read by ComboSelect via
   *  `iconField`/`iconColorField` (`_icon`/`_icon_color` convention). */
  const KIND_ICONS: Record<string, { icon: string; color?: string }> = {
    list: { icon: 'list-plus' },
    map: { icon: 'braces' },
    path: { icon: 'zap', color: 'amber-500' },
    const: { icon: 'text-cursor-input' },
    meta: { icon: 'activity-cog' },
    inject: { icon: 'send' },
  };

  /** Source vocabulary per field — human labels, closed per shape.
   *  `inject` only appears to DISPLAY an already-declared entry. */
  function kindOptionsFor(prop: JsonSchema, entry: PayloadMapEntry | undefined): KindOption[] {
    const opts: KindOption[] = [];
    const push = (kind: string, label: string) =>
      opts.push({ value: kind, label, _icon: KIND_ICONS[kind]?.icon, _icon_color: KIND_ICONS[kind]?.color });
    if (prop.type === 'array') push('list', $t('app.widgets.payload_map.kind.list'));
    if (prop.type === 'object') {
      push('map', prop[PAYLOAD_X_MAP_KEYS] ? $t('app.widgets.payload_map.kind.map_vars') : $t('app.widgets.payload_map.kind.map'));
    }
    push('path', $t('app.widgets.payload_map.kind.path'));
    if (prop.type !== 'array') push('const', $t('app.widgets.payload_map.kind.const'));
    push('meta', $t('app.widgets.payload_map.kind.meta'));
    if (entry?.kind === 'inject') push('inject', $t('app.widgets.payload_map.kind.inject'));
    return opts;
  }

  /** Leaf sources for clauses / list items / map values — scalar only.
   *  Same labels AND icons as the parent row picker — one vocabulary. */
  const LEAF_KIND_OPTIONS = $derived<KindOption[]>(
    ['path', 'const', 'meta'].map((kind) => ({
      value: kind,
      label: $t(`app.widgets.payload_map.kind.${kind}`),
      _icon: KIND_ICONS[kind]?.icon,
      _icon_color: KIND_ICONS[kind]?.color,
    })),
  );

  /** Declarative icon per `meta` source — same `_icon` convention. */
  const META_ICONS: Record<string, string> = {
    actor_uuid: 'user-cog',
    rule_id: 'file-key',
    fired_at: 'clock-check',
    actor_locale: 'languages',
  };

  const META_OPTIONS = $derived(
    PAYLOAD_MAP_META_KINDS.map((k) => ({
      value: k,
      label: $t(`app.widgets.payload_map.meta.${k}`),
      _icon: META_ICONS[k],
    })),
  );
  const INJECT_OPTIONS = $derived(
    PAYLOAD_INJECTORS.map((k) => ({ value: k, label: $t(`app.widgets.payload_map.inject.${k}`) })),
  );

  // ─── Entry mutation helpers ──────────────────────────────────────────

  function setKind(field: string, kind: string, prop: JsonSchema): void {
    if (!kind) {
      writeEntry(field, undefined);
      return;
    }
    const prev = entryOf(field);
    if (prev?.kind === kind) return;
    const fb = fallbackOf(prev);
    const withFb = fb ? { fallback: fb } : {};
    if (kind === 'const') writeEntry(field, { kind: 'const', value: defaultConst(prop), ...withFb });
    else if (kind === 'path') writeEntry(field, { kind: 'path', path: '$', ...withFb });
    else if (kind === 'meta') writeEntry(field, { kind: 'meta', meta: 'actor_uuid', ...withFb });
    else if (kind === 'list') writeEntry(field, { kind: 'list', items: [], ...withFb });
    else if (kind === 'map') writeEntry(field, { kind: 'map', entries: {}, ...withFb });
    else if (kind === 'inject' && prev?.kind === 'inject') writeEntry(field, prev);
  }

  /** Type-aware literal default for a freshly-const'd field. */
  function defaultConst(prop: JsonSchema | undefined): unknown {
    if (prop?.enum?.length) return prop.enum[0];
    switch (prop?.type) {
      case 'integer':
      case 'number': return 0;
      case 'boolean': return false;
      case 'array': return [];
      case 'object': return {};
      default: return '';
    }
  }

  /** Coerce typed text into the property's declared JSON type. */
  function coerceConst(raw: string, prop: JsonSchema | undefined): unknown {
    if (prop?.enum?.length) return raw;
    switch (prop?.type) {
      case 'integer': return raw === '' ? 0 : Number.parseInt(raw, 10);
      case 'number': return raw === '' ? 0 : Number.parseFloat(raw);
      case 'boolean': return raw === 'true';
      case 'array':
      case 'object': {
        try { return JSON.parse(raw || (prop?.type === 'array' ? '[]' : '{}')); }
        catch { return raw; }
      }
      default: return raw;
    }
  }

  /** Replace a field's PRIMARY leaf, preserving its fallback clauses. */
  function setPrimaryLeaf(field: string, leaf: PayloadMapLeafEntry): void {
    const fb = fallbackOf(entryOf(field));
    writeEntry(field, fb ? { ...leaf, fallback: fb } : leaf);
  }

  function constText(e: { kind: string; value?: unknown } | undefined): string {
    if (e?.kind !== 'const') return '';
    const v = e.value;
    if (v === undefined || v === null) return '';
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
  }

  // ─── fallback clause helpers — property OF the entry ────────────────

  function clausesOf(field: string): PayloadMapFallbackClause[] {
    return fallbackOf(entryOf(field)) ?? [];
  }
  function setClauses(field: string, clauses: PayloadMapFallbackClause[]): void {
    const e = entryOf(field);
    if (!e) return;
    writeEntry(field, { ...e, fallback: clauses.length > 0 ? clauses : undefined });
  }
  function addClause(field: string): void {
    setClauses(field, [...clausesOf(field), { kind: 'path', path: '$' }]);
  }
  function setClauseItem(field: string, idx: number, clause: PayloadMapFallbackClause): void {
    const clauses = [...clausesOf(field)];
    clauses[idx] = clause;
    setClauses(field, clauses);
  }
  function setClauseKind(field: string, idx: number, kind: string): void {
    if (kind === 'const') setClauseItem(field, idx, { kind: 'const', value: '' });
    else if (kind === 'meta') setClauseItem(field, idx, { kind: 'meta', meta: 'actor_uuid' });
    else setClauseItem(field, idx, { kind: 'path', path: '$' });
  }
  function moveClause(field: string, idx: number, dir: -1 | 1): void {
    const clauses = [...clausesOf(field)];
    const j = idx + dir;
    if (j < 0 || j >= clauses.length) return;
    [clauses[idx], clauses[j]] = [clauses[j]!, clauses[idx]!];
    setClauses(field, clauses);
  }

  // ─── list items helpers (array fields) ───────────────────────────────

  function itemsOf(field: string): PayloadMapItemEntry[] {
    const e = entryOf(field);
    return e?.kind === 'list' ? e.items : [];
  }
  function setItems(field: string, items: PayloadMapItemEntry[]): void {
    const e = entryOf(field);
    if (e?.kind !== 'list') return;
    writeEntry(field, { ...e, items });
  }

  // ─── map entries helpers (object fields) ─────────────────────────────

  function mapEntriesOf(field: string): Record<string, PayloadMapItemEntry> {
    const e = entryOf(field);
    return e?.kind === 'map' ? e.entries : {};
  }
  function setMapEntries(field: string, entries: Record<string, PayloadMapItemEntry>): void {
    const e = entryOf(field);
    if (e?.kind !== 'map') return;
    writeEntry(field, { ...e, entries });
  }
  function setMapKey(field: string, key: string, entry: PayloadMapItemEntry | undefined): void {
    const entries = { ...mapEntriesOf(field) };
    if (entry === undefined) delete entries[key];
    else entries[key] = entry;
    setMapEntries(field, entries);
  }
  function setMapKeyLeaf(field: string, key: string, leaf: PayloadMapLeafEntry): void {
    const fb = fallbackOf(mapEntriesOf(field)[key]);
    setMapKey(field, key, fb ? { ...leaf, fallback: fb } : leaf);
  }
  function setMapKeyKind(field: string, key: string, kind: string): void {
    if (kind === 'const') setMapKeyLeaf(field, key, { kind: 'const', value: '' });
    else if (kind === 'meta') setMapKeyLeaf(field, key, { kind: 'meta', meta: 'actor_uuid' });
    else setMapKeyLeaf(field, key, { kind: 'path', path: '$' });
  }
  function addMapKey(field: string, key: string): void {
    if (!key || mapEntriesOf(field)[key] !== undefined) return;
    setMapEntries(field, { ...mapEntriesOf(field), [key]: { kind: 'path', path: '$' } });
  }

  const editable = $derived(!readonly && !disabled);
</script>

{#snippet leafValue(
  entry: PayloadMapLeafEntry | PayloadMapItemEntry | undefined,
  prop: JsonSchema | undefined,
  opts: {
    /** Field whose `x_options`/`enum` feed const pickers — unset inside
     *  map values (the field's catalog doesn't apply per-key). */
    field?: string;
    onLeaf: (leaf: PayloadMapLeafEntry) => void;
    onInject?: (inject: PayloadInjector) => void;
  },
)}
  {@const field = opts.field}
  {#if entry?.kind === 'const'}
    {@const xOptions = field ? (optionsCache[field] as ResolvedOption[] | undefined) : undefined}
    {@const enumOpts = prop?.enum?.map((v) => ({ value: String(v), label: String(v) }))}
    {#if prop?.type === 'array'}
      <!-- Fixed value on an array field = a chip composer: the user types
           each element, Enter creates it as a badge, repeat — the wire
           value is `{kind:"const", value: string[]}`. -->
      <ComboSelect
        mode="multi"
        value={Array.isArray(entry.value) ? entry.value.map(String) : []}
        options={Array.isArray(entry.value) ? entry.value.map((v) => ({ value: String(v), label: String(v) })) : []}
        valueField="value"
        labelField="label"
        allowCreate
        placeholder={$t('app.widgets.payload_map.const_array_placeholder')}
        disabled={!editable}
        onChange={(v) => editable && opts.onLeaf({ kind: 'const', value: Array.isArray(v) ? v : [] })}
      />
    {:else if field && (targetSchema?.properties?.[field] as JsonSchema | undefined)?.[PAYLOAD_X_OPTIONS] && xOptions}
      <ComboSelect
        mode="single"
        value={constText(entry)}
        options={xOptions}
        valueField="value"
        labelField="label"
        descriptionField="_desc"
        secondaryField="_sub"
        iconField="_icon"
        iconColorField="_icon_color"
        iconDashedField="_icon_dashed"
        flagField="_flag"
        display="detailed"
        disabled={!editable}
        onChange={(v) => editable && opts.onLeaf({ kind: 'const', value: String(v) })}
      />
    {:else if enumOpts?.length}
      <ComboSelect
        mode="single"
        value={constText(entry)}
        options={enumOpts}
        valueField="value"
        labelField="label"
        searchable={false}
        disabled={!editable}
        onChange={(v) => editable && opts.onLeaf({ kind: 'const', value: String(v) })}
      />
    {:else}
      <TextInput
        value={constText(entry)}
        readonly={!editable}
        oninput={(e) => editable && opts.onLeaf({ kind: 'const', value: coerceConst(e.currentTarget.value, prop) })}
      />
    {/if}
  {:else if entry?.kind === 'path'}
    {#if pathOptions.length > 0}
      <ComboSelect
        mode="single"
        value={entry.path}
        options={pathOptions}
        valueField="value"
        labelField="label"
        secondaryField="_sub"
        display="detailed"
        allowCreate
        disabled={!editable}
        onChange={(v) => editable && opts.onLeaf({ kind: 'path', path: String(v) })}
      />
    {:else}
      <TextInput
        value={entry.path}
        readonly={!editable}
        placeholder="$.field.path"
        oninput={(e) => editable && opts.onLeaf({ kind: 'path', path: e.currentTarget.value })}
      />
    {/if}
  {:else if entry?.kind === 'meta'}
    <ComboSelect
      mode="single"
      value={entry.meta}
      options={META_OPTIONS}
      valueField="value"
      labelField="label"
      iconField="_icon"
      searchable={false}
      disabled={!editable}
      onChange={(v) => editable && opts.onLeaf({ kind: 'meta', meta: String(v) as PayloadMapMeta })}
    />
  {:else if entry?.kind === 'inject'}
    <ComboSelect
      mode="single"
      value={entry.inject}
      options={INJECT_OPTIONS}
      valueField="value"
      labelField="label"
      searchable={false}
      disabled={!editable || !opts.onInject}
      onChange={(v) => editable && opts.onInject?.(String(v) as PayloadInjector)}
    />
  {:else}
    <span class="text-xs text-muted-foreground italic">
      {$t('app.widgets.payload_map.unmapped')}
    </span>
  {/if}
{/snippet}

{#snippet fallbackClauses(field: string)}
  {@const clauses = clausesOf(field)}
  {#if clauses.length > 0}
    <div class="mt-2 space-y-1">
      {#each clauses as clause, i (i)}
        <!-- Same 3-column grid as the parent field row: lead | kind | value+CTAs. -->
        <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] items-center gap-2">
          <span class="min-w-0 text-xs italic text-muted-foreground">
            {$t('app.widgets.payload_map.fallback.lead')}
          </span>
          <div class="min-w-0">
            <ComboSelect
              mode="single"
              value={clause.kind}
              options={LEAF_KIND_OPTIONS}
              valueField="value"
              labelField="label"
              iconField="_icon"
              iconColorField="_icon_color"
              searchable={false}
              disabled={!editable}
              onChange={(v) => editable && setClauseKind(field, i, String(v))}
            />
          </div>
          <div class="flex min-w-0 items-center gap-1">
            <div class="min-w-0 flex-1">
              {@render leafValue(clause, undefined, {
                field,
                onLeaf: (leaf) => setClauseItem(field, i, leaf),
              })}
            </div>
            {#if editable}
              <div class="flex items-center shrink-0">
                <button type="button" class="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title={$t('app.widgets.payload_map.fallback.move_up')} onclick={() => moveClause(field, i, -1)}>
                  <DynamicIcon name="chevron-up" size={18} />
                </button>
                <button type="button" class="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title={$t('app.widgets.payload_map.fallback.move_down')} onclick={() => moveClause(field, i, 1)}>
                  <DynamicIcon name="chevron-down" size={18} />
                </button>
                <button type="button" class="rounded p-1.5 text-destructive hover:bg-destructive/10" title={$t('app.common.delete')} onclick={() => setClauses(field, clauses.filter((_, j) => j !== i))}>
                  <DynamicIcon name="trash" size={18} />
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
  {#if editable}
    <button
      type="button"
      class="mt-1 text-xs text-muted-foreground underline"
      data-testid={`payload-map-fallback-add-${field}`}
      onclick={() => addClause(field)}
    >+ {$t('app.widgets.payload_map.fallback.add')}</button>
  {/if}
{/snippet}

{#snippet fieldRow(field: string, prop: JsonSchema)}
  {@const entry = entryOf(field)}
  <div class="px-3 py-2" data-testid={`payload-map-row-${field}`}>
    <!-- name · source · value — name wraps, combo fits its cell -->
    <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] items-center gap-2">
      <div class="min-w-0">
        <span class="inline-flex items-center gap-1 font-mono text-xs break-all leading-tight" title={field}>
          {#if requiredSet.has(field)}
            <span class="text-destructive" title={$t('app.widgets.payload_map.required')}>*</span>
          {/if}{field}
          {#if prop.description}
            <FormLabelWithPriorityHelp text={prop.description} priority="INFORMATION" />
          {/if}
        </span>
      </div>
      <div class="min-w-0">
        <ComboSelect
          mode="single"
          value={entry?.kind ?? ''}
          options={kindOptionsFor(prop, entry)}
          valueField="value"
          labelField="label"
          iconField="_icon"
          iconColorField="_icon_color"
          placeholder={$t('app.widgets.payload_map.source_placeholder')}
          searchable={false}
          disabled={!editable}
          onChange={(v) => editable && setKind(field, String(v), prop)}
        />
      </div>
      <div class="min-w-0">
        {#if entry?.kind === 'list'}
          <!-- ONE empty combobox for the whole array: the user types each
               element and it becomes a chip + a list option (self-injected
               so it stays visible on reopen). Serializes each chip to
               `{kind:"const"}` inside `{kind:"list", items:[…]}` —
               non-const items from legacy docs are preserved untouched. -->
          {@const constItems = itemsOf(field).filter((it) => it.kind === 'const')}
          {@const listOpts = constItems.map((it) => ({ value: String((it as { value?: unknown }).value ?? ''), label: String((it as { value?: unknown }).value ?? '') }))}
          <ComboSelect
            mode="multi"
            value={constItems.map((it) => String((it as { value?: unknown }).value ?? ''))}
            options={listOpts}
            valueField="value"
            labelField="label"
            allowCreate
            placeholder={$t('app.widgets.payload_map.const_array_placeholder')}
            disabled={!editable}
            onChange={(v) => editable && setItems(field, [
              ...itemsOf(field).filter((it) => it.kind !== 'const'),
              ...(Array.isArray(v) ? v : []).map((s) => ({ kind: 'const' as const, value: s })),
            ])}
          />
        {:else if entry?.kind === 'map'}
          {@const blocked = mapBlockedFrom(prop)}
          <div class="space-y-1">
            {#if blocked}
              <p class="text-xs text-muted-foreground" data-testid={`payload-map-blocked-${field}`}>
                {$t('app.widgets.payload_map.map_blocked', { field: blocked })}
              </p>
            {/if}
            {#each Object.entries(entry.entries) as [key, sub] (key)}
              <div class="flex items-center gap-1">
                <span class="w-28 shrink-0 truncate font-mono text-xs" title={key}>{key}</span>
                <div class="w-36 shrink-0">
                  <ComboSelect
                    mode="single"
                    value={sub.kind}
                    options={sub.kind === 'inject'
                      ? [...LEAF_KIND_OPTIONS, { value: 'inject', label: $t('app.widgets.payload_map.kind.inject'), _icon: KIND_ICONS.inject?.icon }]
                      : LEAF_KIND_OPTIONS}
                    valueField="value"
                    labelField="label"
                    iconField="_icon"
                    iconColorField="_icon_color"
                    searchable={false}
                    disabled={!editable || blocked !== null}
                    onChange={(v) => editable && setMapKeyKind(field, key, String(v))}
                  />
                </div>
                <div class="min-w-0 flex-1">
                  {@render leafValue(sub, undefined, {
                    onLeaf: (leaf) => setMapKeyLeaf(field, key, leaf),
                    onInject: (inject) => setMapKey(field, key, { kind: 'inject', inject }),
                  })}
                </div>
                {#if editable}
                  <button type="button" class="rounded p-0.5 text-destructive hover:bg-destructive/10" title={$t('app.common.delete')} onclick={() => setMapKey(field, key, undefined)}>
                    <DynamicIcon name="trash" size={18} />
                  </button>
                {/if}
              </div>
            {/each}
            {#if editable}
              {@const keyOpts = mapKeyOptions(prop).filter((o) => !(o.value in entry.entries))}
              {#if keyOpts.length > 0}
                <ComboSelect
                  mode="single"
                  value=""
                  options={keyOpts}
                  valueField="value"
                  labelField="label"
                  placeholder={$t('app.widgets.payload_map.map.add_key')}
                  allowCreate
                  disabled={blocked !== null}
                  onChange={(v) => editable && addMapKey(field, String(v))}
                />
              {:else}
                <input
                  type="text"
                  class="w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                  placeholder={$t('app.widgets.payload_map.map.add_key')}
                  disabled={blocked !== null}
                  onkeydown={(e) => {
                    if (e.key === 'Enter') {
                      addMapKey(field, e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
              {/if}
            {/if}
          </div>
        {:else}
          {@render leafValue(entry, prop, {
            field,
            onLeaf: (leaf) => setPrimaryLeaf(field, leaf),
            onInject: (inject) => {
              const fb = fallbackOf(entryOf(field));
              writeEntry(field, { kind: 'inject', inject, ...(fb ? { fallback: fb } : {}) });
            },
          })}
        {/if}
      </div>
    </div>
    {#if entry}
      {@render fallbackClauses(field)}
    {/if}
  </div>
{/snippet}

<div class={cn('space-y-3', className)} {...rest}>
  <p class="text-xs text-muted-foreground" data-testid="payload-map-subtitle">
    {$t('app.widgets.payload_map.subtitle')}
  </p>
  {#if has_user_task}
    {#if requiredFields.length > 0}
      <div class="rounded-md border divide-y" data-testid="payload-map-rows">
        {#each requiredFields as [field, prop] (field)}
          {@render fieldRow(field, prop)}
        {/each}
      </div>
    {/if}
    {#if optionalFields.length > 0}
      <Accordion.Root type="single" class="rounded-md border" data-testid="payload-map-optional">
        <Accordion.Item value="optional" class="border-0">
          <Accordion.Trigger class="px-3 text-xs text-muted-foreground">
            {$t('app.widgets.payload_map.optional', { count: optionalFields.length })}
          </Accordion.Trigger>
          <Accordion.Content class="pb-0">
            <div class="divide-y border-t">
              {#each optionalFields as [field, prop] (field)}
                {@render fieldRow(field, prop)}
              {/each}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    {/if}

    <JsonValueEditor
      data-testid="payload-map-json-editor"
      preview_open={false}
      bind:value
      schema={{
        type: 'object',
        additionalProperties: {
          type: 'object',
          required: ['kind'],
          properties: {
            kind: { enum: ['const', 'path', 'meta', 'inject', 'list', 'map'] },
            value: {},
            path: { type: 'string' },
            meta: { enum: [...PAYLOAD_MAP_META_KINDS] },
            inject: { enum: [...PAYLOAD_INJECTORS] },
            items: { type: 'array' },
            entries: { type: 'object' },
            fallback: { type: 'array' },
          },
        },
      }}
      minRows={6}
      {readonly}
      {disabled}
      {on_ai_assist}
      {ai_label}
      {extra_completions}
    />
  {:else}
    <!-- The user has NO task: no mappable contract, or every field is a
         system-owned setter the platform materializes on its own. The
         column keeps its slot — a prominent info state says so instead of
         a purposeless JSON editor. -->
    <div class="flex flex-col items-center justify-center gap-4 py-12" data-testid="payload-map-empty">
      <DynamicIcon name="braces" size={56} class="payload-map-empty__icon text-info opacity-60" />
      <p class="text-sm font-medium text-info opacity-80">{$t('app.widgets.payload_map.empty')}</p>
    </div>
  {/if}
</div>

<style>
  .payload-map-empty__icon {
    animation: payload-map-empty-float 3s ease-in-out infinite;
  }
  @keyframes payload-map-empty-float {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-8px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .payload-map-empty__icon {
      animation: none;
    }
  }
</style>
