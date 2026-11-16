<script lang="ts">
  /**
   * PayloadMapViewer — the READ-ONLY mirror of `PayloadMapEditor`:
   * 50/50 two-column row anatomy — left: type icon + field name +
   * required `*` + help; right: line 1 source-kind icon + translated
   * label, line 2 the mapped value. `border divide-y`, prose in place
   * of inputs.
   *
   * Rows are the map's authored entries (document order); the target
   * schema — when the host resolves it — drives type icons, required
   * markers, and the "Unmapped fields" accordion for declared-but-not-
   * authored fields. Without a schema the viewer degrades to authored
   * rows only. Unparseable DST degrades to a raw JSON block.
   *
   * Generic over the DST contract (`PayloadMapEntry` vocabulary in
   * `@primebrick/core`): any mapper adopting the same DST can reuse it.
   */
  import type {
    PayloadMap,
    PayloadMapEntry,
    PayloadMapItemEntry,
  } from '@primebrick/core';
  import {
    PAYLOAD_X_HELP_KEY,
    PAYLOAD_X_NOT_EDITABLE,
    PAYLOAD_X_MAP_KEYS,
  } from '@primebrick/core';
  import DynamicIcon from '../dynamic-icon/DynamicIcon.svelte';
  import FormLabelWithPriorityHelp from '../forms/FormLabelWithPriorityHelp.svelte';
  import JsonCodeBlock from '../json-code-block/json-code-block.svelte';
  import * as Accordion from '../accordion/index.js';
  import { colorCssFromToken } from '../../colors/badge.js';
  import { getT } from '../../bridges.js';
  import { cn } from '../../utils/index.js';
  import type { HTMLAttributes } from 'svelte/elements';

  const t = getT();

  /** Same minimal schema shape the editor declares locally. */
  interface JsonSchema {
    type?: string;
    description?: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    enum?: unknown[];
    items?: JsonSchema;
    [k: string]: unknown;
  }

  interface Props extends HTMLAttributes<HTMLDivElement> {
    /** The DST document — same JSON text the editor binds. */
    value: string;
    /** Target callable's `payload_schema` — optional; enables type icons,
     *  required markers and the unmapped-fields accordion. */
    target_schema?: JsonSchema;
  }

  let { value, target_schema, class: className, ...rest }: Props = $props();

  /** Same declarative kind icons the editor's pickers use — one vocabulary. */
  const KIND_ICONS: Record<string, { icon: string; color?: string }> = {
    list: { icon: 'list-plus' },
    map: { icon: 'braces' },
    path: { icon: 'zap', color: 'amber-500' },
    const: { icon: 'text-cursor-input' },
    meta: { icon: 'activity-cog' },
    inject: { icon: 'send' },
  };

  const META_ICONS: Record<string, string> = {
    actor_uuid: 'user-cog',
    actor_email: 'mail',
    creator_email: 'mail',
    trigger_id: 'file-key',
    fired_at: 'clock-check',
    actor_locale: 'languages',
  };

  const FORMAT_TYPE_ICONS: Record<string, string> = {
    email: 'mail',
    url: 'link',
    uri: 'link',
    uuid: 'file-key',
    lang: 'languages',
    'date-time': 'calendar-clock',
    date: 'calendar',
  };
  const TYPE_ICONS: Record<string, string> = {
    string: 'type',
    integer: 'hash',
    number: 'hash',
    boolean: 'toggle-left',
    array: 'list',
    object: 'braces',
  };

  function typeIcon(schema: JsonSchema | undefined): { _icon: string; _icon_dashed?: boolean } {
    if (!schema) return { _icon: 'type' };
    const raw = schema.type;
    const types = Array.isArray(raw) ? raw.map(String) : raw !== undefined ? [String(raw)] : [];
    const nullable = types.includes('null');
    const base = types.find((x) => x !== 'null') ?? 'string';
    const icon =
      (typeof schema.format === 'string' ? FORMAT_TYPE_ICONS[schema.format] : undefined) ??
      TYPE_ICONS[base] ??
      'type';
    return nullable ? { _icon: icon, _icon_dashed: true } : { _icon: icon };
  }

  /** Parsed DST — unparseable text flags `bad` so the view degrades to raw. */
  const parsed = $derived.by((): { map: PayloadMap; bad: boolean } => {
    try {
      // standards-exempt: ext-json — the DST document IS plain JSON text, not an ext-json wire payload
      const p = JSON.parse(value || 'null');
      return p && typeof p === 'object' && !Array.isArray(p)
        ? { map: p as PayloadMap, bad: false }
        : { map: {}, bad: p !== null };
    } catch {
      return { map: {}, bad: true };
    }
  });

  const targetSchema = $derived(target_schema as JsonSchema | undefined);
  const requiredSet = $derived(new Set(targetSchema?.required ?? []));

  /** Authored entries — the visible rows, document order. */
  const authoredRows = $derived(
    Object.entries(parsed.map).filter(
      (kv): kv is [string, PayloadMapEntry] =>
        kv[1] !== null && typeof kv[1] === 'object' && 'kind' in kv[1],
    ),
  );

  function isNotEditable(prop: JsonSchema): boolean {
    return prop[PAYLOAD_X_NOT_EDITABLE] === true;
  }

  /** Declared target fields with no authored entry — the accordion below. */
  const unmappedFields = $derived(
    Object.entries(targetSchema?.properties ?? {}).filter(
      ([f, prop]) => !(f in parsed.map) && !isNotEditable(prop as JsonSchema),
    ),
  );

  function kindLabel(field: string, entry: PayloadMapEntry): string {
    if (entry.kind === 'map') {
      const prop = targetSchema?.properties?.[field] as JsonSchema | undefined;
      if (prop?.[PAYLOAD_X_MAP_KEYS]) return $t('app.widgets.payload_map.kind.map_vars');
    }
    return $t(`app.widgets.payload_map.kind.${entry.kind}`);
  }

  /** One-line prose for a leaf/item entry — the "source" the row describes. */
  function entryProse(e: PayloadMapItemEntry): { icon?: string; text: string } {
    switch (e.kind) {
      case 'const':
        // standards-exempt: ext-json — display serialization for the const preview, not a wire payload
        return { text: typeof e.value === 'object' ? JSON.stringify(e.value) : String(e.value) };
      case 'path':
        return { text: e.path || '—' };
      case 'meta':
        return {
          icon: e.meta ? META_ICONS[e.meta] : undefined,
          text: e.meta ? $t(`app.widgets.payload_map.meta.${e.meta}`) : '—',
        };
      case 'inject':
        return { text: $t(`app.widgets.payload_map.inject.${e.inject}`) };
      default:
        return { text: '—' };
    }
  }

  function clauses(e: { fallback?: { kind: string }[] } | undefined) {
    return e?.fallback ?? [];
  }
</script>

{#snippet proseCell(e: PayloadMapItemEntry)}
  {@const p = entryProse(e)}
  <span class="inline-flex min-w-0 items-center gap-1.5 text-xs">
    {#if p.icon}<DynamicIcon name={p.icon} size={12} class="shrink-0 text-muted-foreground" />{/if}
    <span class="truncate font-mono text-[11px]">{p.text}</span>
  </span>
{/snippet}

{#snippet fallbackLines(e: PayloadMapEntry | PayloadMapItemEntry)}
  {#each clauses(e as PayloadMapEntry) as clause, i (i)}
    <div class="flex items-center gap-1.5 pl-6 pt-1 text-xs text-muted-foreground" data-testid="mapper-viewer-fallback">
      <span>{$t('app.widgets.payload_map.fallback.lead')}</span>
      <span class="text-foreground/70">→</span>
      {@render proseCell(clause as PayloadMapItemEntry)}
    </div>
  {/each}
{/snippet}

{#snippet mapEntries(entries: Record<string, PayloadMapItemEntry>)}
  <div class="mt-1 space-y-1 pl-6" data-testid="mapper-viewer-map-entries">
    {#each Object.entries(entries) as [key, sub] (key)}
      <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-start gap-2">
        <span class="font-mono text-[11px] text-muted-foreground break-all">{key}</span>
        <span class="min-w-0">
          {@render proseCell(sub)}
          {@render fallbackLines(sub)}
        </span>
      </div>
    {/each}
  </div>
{/snippet}

{#snippet listItems(items: PayloadMapItemEntry[])}
  <div class="flex flex-wrap gap-1" data-testid="mapper-viewer-list-items">
    {#each items as item, i (i)}
      {@const p = entryProse(item)}
      <span class="inline-flex items-center gap-1 rounded-sm border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px]">
        {#if p.icon}<DynamicIcon name={p.icon} size={11} class="shrink-0 text-muted-foreground" />{/if}
        {p.text}
      </span>
    {/each}
    {#if items.length === 0}
      <span class="text-xs italic text-muted-foreground">—</span>
    {/if}
  </div>
{/snippet}

<div class={cn('space-y-3', className)} {...rest}>
  {#if parsed.bad}
    <JsonCodeBlock code={value} />
  {:else if authoredRows.length === 0}
    <p class="py-6 text-center text-xs italic text-muted-foreground" data-testid="mapper-viewer-empty">
      {$t('app.widgets.mapper.empty')}
    </p>
  {:else}
    <div class="rounded-md border divide-y" data-testid="mapper-viewer-rows">
      {#each authoredRows as [field, entry] (field)}
        {@const prop = targetSchema?.properties?.[field] as JsonSchema | undefined}
        {@const ti = typeIcon(prop)}
        {@const ki = KIND_ICONS[entry.kind]}
        <div class="px-3 py-2" data-testid={`mapper-viewer-row-${field}`}>
          <div class="grid grid-cols-2 items-start gap-3">
            <div class="min-w-0">
              <span class="inline-flex items-center gap-1 font-mono text-xs break-all leading-tight" title={field}>
                <DynamicIcon name={ti._icon} size={13} class={cn('shrink-0 text-muted-foreground', ti._icon_dashed && '[&_path]:[stroke-dasharray:3_1.5]')} />
                {#if requiredSet.has(field)}
                  <span class="text-destructive" title={$t('app.widgets.payload_map.required')}>*</span>
                {/if}{field}
                {#if prop?.[PAYLOAD_X_HELP_KEY] || prop?.description}
                  <FormLabelWithPriorityHelp
                    text={typeof prop[PAYLOAD_X_HELP_KEY] === 'string' ? $t(prop[PAYLOAD_X_HELP_KEY] as string) : (prop.description as string | undefined)}
                    priority="INFORMATION" />
                {/if}
              </span>
            </div>
            <div class="min-w-0">
              <span class="inline-flex items-center gap-1.5 text-xs" data-testid={`mapper-viewer-kind-${field}`}>
                {#if ki}<DynamicIcon name={ki.icon} size={12} class="shrink-0 text-muted-foreground" style={ki.color ? (colorCssFromToken(ki.color) ?? undefined) : undefined} />{/if}
                {kindLabel(field, entry)}
              </span>
              <div class="mt-1" data-testid={`mapper-viewer-value-${field}`}>
                {#if entry.kind === 'list'}
                  {@render listItems(entry.items)}
                {:else if entry.kind === 'map'}
                  <span class="text-xs text-muted-foreground">{Object.keys(entry.entries).length} {entry.entries && Object.keys(entry.entries).length === 1 ? 'key' : 'keys'}</span>
                {:else}
                  {@render proseCell(entry as PayloadMapItemEntry)}
                {/if}
              </div>
            </div>
          </div>
          {#if entry.kind === 'map'}
            {@render mapEntries(entry.entries)}
          {/if}
          {@render fallbackLines(entry)}
        </div>
      {/each}
    </div>
  {/if}

  {#if unmappedFields.length > 0}
    <Accordion.Root type="single" class="rounded-md border" data-testid="mapper-viewer-unmapped">
      <Accordion.Item value="unmapped" class="border-0">
        <Accordion.Trigger class="px-3 text-xs text-muted-foreground">
          {$t('app.widgets.mapper.unmapped', { count: unmappedFields.length })}
        </Accordion.Trigger>
        <Accordion.Content class="pb-0">
          <div class="divide-y border-t">
            {#each unmappedFields as [field, prop] (field)}
              {@const ti = typeIcon(prop as JsonSchema)}
              <div class="grid grid-cols-2 items-start gap-3 px-3 py-2" data-testid={`mapper-viewer-unmapped-${field}`}>
                <span class="inline-flex items-center gap-1 font-mono text-xs break-all leading-tight text-muted-foreground">
                  <DynamicIcon name={ti._icon} size={13} class="shrink-0" />
                  {#if requiredSet.has(field)}<span class="text-destructive">*</span>{/if}{field}
                </span>
                <span class="text-xs italic text-muted-foreground">{$t('app.widgets.mapper.not_mapped')}</span>
              </div>
            {/each}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  {/if}
</div>
