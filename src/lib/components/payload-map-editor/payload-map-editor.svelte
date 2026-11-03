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
    MapKeyDecl,
    FieldIssue,
  } from '@primebrick/core';
  import {
    PAYLOAD_MAP_META_KINDS,
    PAYLOAD_MAP_META_SCHEMAS,
    PAYLOAD_INJECTORS,
    PAYLOAD_X_HELP_KEY,
    PAYLOAD_X_MAP_KEYS,
    PAYLOAD_X_NOT_EDITABLE,
    PAYLOAD_X_OPTIONS,
    PAYLOAD_X_SEMANTIC,
    pathCompatible,
    parseMapKeysDeclaration,
    payloadMapConformance,
    jsonSchemaCheck,
  } from '@primebrick/core';
  import TextInput from '../input/text-input.svelte';
  import ComboSelect from '../combo-select/combo-select.svelte';
  import PropNavigator from '../prop-navigator/prop-navigator.svelte';
  import type { PropNavNode } from '../prop-navigator/prop-nav.types.js';
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

  /**
   * Design-time conformance marks — the same `payloadMapConformance`
   * predicate the submit gate and the service-side write hook run. Issues
   * are grouped by destination field so each row can flag an invalid
   * `const` (or an unmapped required field) inline: marking only — the
   * document stays editable and the form's standard validity gate owns
   * the submit block.
   */
  /** Resolved `x_map_keys` key schemas per field — `{field: {key:
   *  schema}}` — passed to `payloadMapConformance` so a `const` typed
   *  against a declared key (`"hhhhh"` on `amount:"number"`) fails
   *  `invalid_type` instead of passing on the record's empty
   *  `additionalProperties`. Empty until the catalog row resolves. */
  const keySchemaTable = $derived.by(() => {
    const out: Record<string, Record<string, Record<string, unknown>>> = {};
    for (const [field, prop] of Object.entries(targetSchema?.properties ?? {})) {
      if (!prop[PAYLOAD_X_MAP_KEYS]) continue;
      const schemas = Object.fromEntries(
        Object.entries(mapKeyDecls(prop)).map(([k, d]) => [k, d.schema]),
      );
      if (Object.keys(schemas).length > 0) out[field] = schemas;
    }
    return out;
  });

  const fieldIssues = $derived.by((): Map<string, FieldIssue[]> => {
    const out = new Map<string, FieldIssue[]>();
    if (!targetSchema) return out;
    for (const i of payloadMapConformance(map, targetSchema, sourceSchema, keySchemaTable)) {
      const m = /^payload_map\.([^.[\]]+)/.exec(i.path);
      const f = m?.[1];
      if (!f) continue;
      const list = out.get(f) ?? [];
      list.push(i);
      out.set(f, list);
    }
    return out;
  });

  /** Path scopes inside a field's issue list — `payload_map.<field>`
   *  prefixes: `.fallback[i]` marks the clause's own input, `[i]` a list
   *  item, `.<key>` a map entry. */
  const pf = (f: string) => `payload_map.${f}`;
  const issuesFor = (field: string, pred: (i: FieldIssue) => boolean): FieldIssue[] =>
    (fieldIssues.get(field) ?? []).filter(pred);
  const leafIssues = (field: string) =>
    issuesFor(field, (i) => {
      const base = pf(field);
      if (i.path === base) return true;
      if (i.path.startsWith(`${base}.fallback[`) || i.path.startsWith(`${base}[`)) return false;
      // `.<key>` paths belong to the field's map entries — each renders
      // under its own key row (keyIssues), printing them again under
      // the field duplicates the hint. The same grammar also carries
      // const-object nested prop issues (`jsonSchemaCheck` recurses),
      // so the exclusion is gated on the key being a real map entry.
      if (i.path.startsWith(`${base}.`)) {
        const e = entryOf(field);
        if (e?.kind === 'map' && Object.hasOwn(e.entries, i.path.slice(base.length + 1).split(/[.[\]]/)[0] ?? ''))
          return false;
      }
      return true;
    });
  const itemIssues = (field: string) => issuesFor(field, (i) => i.path.startsWith(`${pf(field)}[`));
  // `.key` boundary-aware: `amount` must not swallow `amount_x` paths.
  // Deeper paths (`key.sub`, `key[i]`) stay key-scoped — the key row
  // owns its whole subtree.
  const keyIssues = (field: string, key: string) =>
    issuesFor(field, (i) => {
      const p = `${pf(field)}.${key}`;
      return i.path === p || i.path.startsWith(`${p}.`) || i.path.startsWith(`${p}[`);
    });
  const clauseIssues = (field: string, idx: number) =>
    issuesFor(field, (i) => i.path === `${pf(field)}.fallback[${idx}]`);

  /** EVERY issue earns a text line under its control — a red control
   *  that can't explain itself is a dead end (`required` included: it
   *  is the most basic validator and MUST say what is missing). Path
   *  scoping (leaf/item/key/clause) owns dedup; nothing is hidden. */

  function isNotEditable(prop: JsonSchema): boolean {
    return prop[PAYLOAD_X_NOT_EDITABLE] === true;
  }

  /** EFFECTIVE required set — schema `required` ∪ fields whose resolved
   *  `x_map_keys` declaration has ≥1 required key (a catalogued template
   *  with required variables promotes `variables` out of the optional
   *  accordion: it sits with the mandatory rows and its own required
   *  sub-keys are already seated). Re-derives when the catalog row
   *  resolves or the selection changes. */
  const effectiveRequired = $derived.by(() => {
    const out = new Set(requiredSet);
    for (const [field, prop] of Object.entries(targetSchema?.properties ?? {})) {
      if (!prop[PAYLOAD_X_MAP_KEYS]) continue;
      if (Object.values(mapKeyDecls(prop)).some((d) => d.required)) out.add(field);
    }
    return out;
  });

  /** Required fields first (alphabetical), optional tail alphabetical —
   *  folded inside a default-closed accordion. `x_not_editable` fields
   *  never render a row (platform-owned setter). */
  const requiredFields = $derived(
    Object.entries(targetSchema?.properties ?? {})
      .filter(([f, p]) => effectiveRequired.has(f) && !isNotEditable(p))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  const optionalFields = $derived(
    Object.entries(targetSchema?.properties ?? {})
      .filter(([f, p]) => !effectiveRequired.has(f) && !isNotEditable(p))
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
   *  navigable TREE the PropNavigator descends. `children` mirror
   *  `properties`; `_schema` carries each node's schema so
   *  `pathCompatible` can screen it against the row's destination field;
   *  `_sub` shows `array<items>` / `type · format`. */
  const pathTree = $derived.by(() => {
    const walk = (schema: JsonSchema | undefined, prefix: string, depth: number): PropNavNode[] => {
      if (!schema?.properties || depth > 5) return [];
      return Object.entries(schema.properties).map(([key, sub]) => {
        const path = `${prefix}.${key}`;
        const children = walk(sub, path, depth + 1);
        return {
          value: path,
          label: key,
          _sub: subLabel(sub),
          _schema: sub,
          ...typeIcon(sub),
          ...(children.length > 0 ? { children } : {}),
        } satisfies PropNavNode;
      });
    };
    return walk(sourceSchema, '$', 1);
  });

  /** Readable type line for a source leaf — honest about the shape, never
   *  a bare `string` when the schema declares more: a `format` IS the type
   *  (`lang`, `email`, `date-time`), arrays unwrap to `array<email>` —
   *  never `array` alone. */
  function subLabel(sub: JsonSchema): string {
    const raw = sub.type;
    const types = Array.isArray(raw) ? raw.map(String) : raw !== undefined ? [String(raw)] : [];
    const base = types.find((t) => t !== 'null');
    if (base === 'array') return `array<${sub.items ? subLabel(sub.items) : 'unknown'}>`;
    if (typeof sub.format === 'string') return sub.format;
    return base ?? 'unknown';
  }

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

  /** Typed key declarations for an `x_map_keys` field — the selected
   *  option's row prop parsed through core's `parseMapKeysDeclaration`
   *  (shorthand `{"k":"type"}` → required; longhand carries the schema +
   *  `optional`/`required:false`/`nullable`). Empty until the `from`
   *  field holds a resolved const (e.g. a chosen template). */
  function mapKeyDecls(prop: JsonSchema): Record<string, MapKeyDecl> {
    const hint = prop[PAYLOAD_X_MAP_KEYS] as PayloadMapKeysHint | undefined;
    if (!hint) return {};
    return parseMapKeysDeclaration(selectedOptionRaw(hint.from)?.[hint.prop]);
  }

  /** The declared schema of ONE map key — drives the row's type icon,
   *  the source pickers' compat partition and the meta default. Falls
   *  back to `additionalProperties` for keys the declaration doesn't
   *  know (custom keys the user adds by hand). */
  function mapKeySchema(prop: JsonSchema | undefined, key: string): JsonSchema | undefined {
    if (!prop) return undefined;
    const decl = mapKeyDecls(prop)[key];
    if (decl) return decl.schema as JsonSchema;
    const ap = prop.additionalProperties;
    return typeof ap === 'object' ? (ap as JsonSchema) : undefined;
  }

  /** Whole-value compat for a path picker's commit — `pathCompatible`
   *  plus the `x_map_keys` coverage rule: when the field resolves to
   *  required declared keys, an OBJECT source is a value only if its own
   *  properties actually provide each required key with a compatible
   *  schema (`$.customer` onto a template's `variables` would silently
   *  ship `code`/`email` where `otp_code` belongs). The node stays
   *  navigable either way — descent is how the honest per-key map is
   *  built; only the commit affordance is gated. No declarations (or no
   *  required ones) → the plain type-level answer stands. */
  function fieldPathCompatible(tp: Record<string, unknown>, n: PropNavNode): boolean {
    if (!pathCompatible(tp, n._schema ?? {})) return false;
    const reqs = Object.entries(mapKeyDecls(tp as JsonSchema)).filter(([, d]) => d.required);
    if (reqs.length === 0) return true;
    const props = (n._schema?.properties ?? {}) as Record<string, Record<string, unknown>>;
    return reqs.every(([k, d]) => {
      const src = props[k];
      return src !== undefined && pathCompatible(d.schema, src);
    });
  }

  /** Key picker options — typed like the event-path list: `_sub` shows
   *  the declared type (`string`/`email`/`array<…>`), `_icon` its
   *  glyph, `_schema` the synthesized schema. */
  function mapKeyOptions(prop: JsonSchema): KindOption[] {
    return Object.entries(mapKeyDecls(prop)).map(([k, d]) => ({
      value: k,
      label: k,
      _sub: subLabel(d.schema as JsonSchema),
      _schema: d.schema,
      ...typeIcon(d.schema as JsonSchema),
    }));
  }

  /** A row still carrying the shape the seeder wrote it in — an empty
   *  `{kind:"path", path:""}` with no fallback clause (a clause is user
   *  work). Filled or hand-authored rows never match. */
  const isEmptyPlaceholder = (sub: PayloadMapItemEntry | undefined): boolean =>
    !!sub && sub.kind === 'path' && !sub.path && !(sub.fallback?.length);

  /** Required-by-default contract — picking a catalogued template IS the
   *  commitment to fill its placeholders: every required declared key
   *  materializes as a map row with an EMPTY path (a `required`
   *  conformance issue until mapped — the standard Save gate applies).
   *  The declaration OWNS the key set: under a resolved (closed)
   *  vocabulary every undeclared entry is an orphan — a previous
   *  template's leftovers or a free-map key authored before the
   *  vocabulary closed — and is pruned, filled or not (a key the
   *  template doesn't declare is meaningless on the wire). While NO
   *  declaration resolves (template cleared or path-sourced) the map is
   *  user-owned: only auto-seeded rows still sitting in their untouched
   *  placeholder shape die; filled rows survive as honest free-map keys.
   *  An explicit leaf/list kind on the field wins: a whole-object source
   *  can legitimately satisfy the same contract. Optional declared keys
   *  never seed — they wait in their accordion until mapped. */
  const autoSeeded = new Map<string, Set<string>>();
  $effect(() => {
    if (!editable) return;
    for (const [field, prop] of Object.entries(targetSchema?.properties ?? {})) {
      if (!prop[PAYLOAD_X_MAP_KEYS]) continue;
      const decls = mapKeyDecls(prop);
      const e = entryOf(field);
      if (e && e.kind !== 'map') continue;
      const cur = e?.kind === 'map' ? e.entries : {};
      const auto = autoSeeded.get(field) ?? new Set<string>();

      const reqKeys = Object.entries(decls)
        .filter(([, d]) => d.required)
        .map(([k]) => k);
      const missing = reqKeys.filter((k) => !(k in cur));

      // Closed vocabulary — the declaration owns the key set: every
      // undeclared entry is contract-invalid and goes. Open vocabulary —
      // no contract to enforce: only the seeder's own untouched
      // placeholders are pruned; user rows (never in `auto`) stay.
      const removed = Object.keys(decls).length > 0
        ? Object.keys(cur).filter((k) => !(k in decls))
        : [...auto].filter((k) => !(k in decls) && isEmptyPlaceholder(cur[k]));

      // `auto` tracks rows still in the seeded shape — a filled row
      // becomes the user's own and leaves the set.
      const nextAuto = new Set([...auto].filter((k) => isEmptyPlaceholder(cur[k])));
      for (const k of missing) nextAuto.add(k);

      if (missing.length === 0 && removed.length === 0) {
        autoSeeded.set(field, nextAuto);
        continue;
      }
      const entries = { ...cur };
      for (const k of removed) delete entries[k];
      for (const k of missing) entries[k] = { kind: 'path' as const, path: '' };
      writeEntry(field, {
        kind: 'map',
        entries,
        ...(e && 'fallback' in e && e.fallback ? { fallback: e.fallback } : {}),
      });
      autoSeeded.set(field, nextAuto);
    }
  });

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
    // `const` is offered only where it is honest: scalar/array targets.
    // On object fields the map editor rows already cover every manual
    // value — a field-level const would mean hand-typing raw JSON,
    // strictly worse AND redundant.
    if (prop.type !== 'array' && prop.type !== 'object') push('const', $t('app.widgets.payload_map.kind.const'));
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

  /** Schema-type icons — the format wins over the bare type (an `email`
   *  string shows `mail`, not `type`). Rendered by ComboSelect via the
   *  `_icon`/`_icon_dashed` convention; nullable unions carry the base
   *  type's icon with the dashed modifier. */
  const FORMAT_TYPE_ICONS: Record<string, string> = {
    email: 'mail',
    url: 'link',
    uri: 'link',
    uuid: 'fingerprint-pattern',
    'date-time': 'calendar-clock',
    datetime: 'calendar-clock',
    date: 'calendar',
    time: 'clock',
    phone: 'phone',
    color_hex: 'palette',
    lang: 'languages',
  };
  const TYPE_ICONS: Record<string, string> = {
    string: 'type',
    number: 'hash',
    integer: 'hash',
    bigint: 'hash',
    boolean: 'toggle-left',
    array: 'brackets',
    object: 'braces',
    null: 'circle-slash',
  };

  /** `{ icon, dashed }` for a schema property — `null` in a type union
   *  flags the base icon as dashed rather than picking a "null" glyph. */
  function typeIcon(schema: JsonSchema | undefined): { _icon: string; _icon_dashed?: boolean } {
    const raw = schema?.type;
    const types = Array.isArray(raw) ? raw.map(String) : raw !== undefined ? [String(raw)] : [];
    const nullable = types.includes('null');
    const base = types.find((t) => t !== 'null');
    let icon: string | undefined;
    // semantic slot wins over plain format — `x_semantic:"actor.uuid"`
    // renders the actor glyph (META_ICONS family), not a bare fingerprint.
    if (schema?.[PAYLOAD_X_SEMANTIC] === 'actor.uuid') icon = 'user-cog';
    if (!icon && typeof schema?.format === 'string') icon = FORMAT_TYPE_ICONS[schema.format];
    if (!icon && Array.isArray(schema?.enum) && schema.enum.length > 0) icon = 'tags';
    if (!icon && schema && 'const' in schema) icon = 'pin';
    if (!icon && base) icon = TYPE_ICONS[base];
    if (!icon) icon = 'circle-question-mark';
    return nullable ? { _icon: icon, _icon_dashed: true } : { _icon: icon };
  }

  /** Declarative icon per `meta` source — same `_icon` convention. */
  const META_ICONS: Record<string, string> = {
    actor_uuid: 'user-cog',
    actor_email: 'mail',
    creator_email: 'mail',
    trigger_id: 'file-key',
    fired_at: 'clock-check',
    actor_locale: 'languages',
  };

  /** Meta sources carry their declared domain (`PAYLOAD_MAP_META_SCHEMAS`)
   *  — the SAME vocabulary the compat filter and the wire gate share, so
   *  `creator_email` (email) is the only context selectable for
   *  `to: array<email>` while `fired_at` (epoch int) stays out. */
  const META_OPTIONS = $derived(
    PAYLOAD_MAP_META_KINDS.map((k) => ({
      value: k,
      label: $t(`app.widgets.payload_map.meta.${k}`),
      _icon: META_ICONS[k],
      _schema: PAYLOAD_MAP_META_SCHEMAS[k],
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
    else if (kind === 'path') writeEntry(field, { kind: 'path', path: '', ...withFb });
    else if (kind === 'meta') {
      const dm = defaultMeta(prop);
      writeEntry(field, { kind: 'meta', ...(dm !== undefined ? { meta: dm } : {}), ...withFb });
    }
    else if (kind === 'list') writeEntry(field, { kind: 'list', items: [], ...withFb });
    else if (kind === 'map') writeEntry(field, { kind: 'map', entries: {}, ...withFb });
    else if (kind === 'inject' && prev?.kind === 'inject') writeEntry(field, prev);
  }

  /** First COMPATIBLE meta kind for the target — never a hardcoded one:
   *  `actor_uuid` as a blind default flashes a conformance error on every
   *  email/lang/number target. When NOTHING is compatible (e.g. an object
   *  target — no context meta is object-shaped) returns undefined: the
   *  picker stays empty and honest instead of auto-selecting a "useless"
   *  first option that can only error. */
  function defaultMeta(prop: JsonSchema | undefined): PayloadMapMeta | undefined {
    return PAYLOAD_MAP_META_KINDS.find((k) =>
      !prop || pathCompatible(prop as Record<string, unknown>, PAYLOAD_MAP_META_SCHEMAS[k]));
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

  /** Coerce typed text into the property's declared JSON type. Numeric
   *  kinds parse STRICT (`Number()` — `parseFloat("12x")→12` would be a
   *  silent lie) and keep the raw text when unparseable — the wire stays
   *  honest and `jsonSchemaCheck` flags `invalid_type` on it, instead of
   *  NaN collapsing to `null`→`required`. */
  function coerceConst(raw: string, prop: JsonSchema | undefined): unknown {
    if (prop?.enum?.length) return raw;
    switch (prop?.type) {
      case 'integer': {
        if (raw === '') return '';
        const n = Number(raw);
        return Number.isInteger(n) ? n : raw;
      }
      case 'number': {
        if (raw === '') return '';
        const n = Number(raw);
        return Number.isFinite(n) ? n : raw;
      }
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
    setClauses(field, [...clausesOf(field), { kind: 'path', path: '' }]);
  }
  function setClauseItem(field: string, idx: number, clause: PayloadMapFallbackClause): void {
    const clauses = [...clausesOf(field)];
    clauses[idx] = clause;
    setClauses(field, clauses);
  }
  function setClauseKind(field: string, idx: number, kind: string): void {
    if (kind === 'const') setClauseItem(field, idx, { kind: 'const', value: '' });
    else if (kind === 'meta') {
      const dm = defaultMeta(targetSchema?.properties?.[field] as JsonSchema | undefined);
      setClauseItem(field, idx, { kind: 'meta', ...(dm !== undefined ? { meta: dm } : {}) });
    }
    else setClauseItem(field, idx, { kind: 'path', path: '' });
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
    const prop = targetSchema?.properties?.[field] as JsonSchema | undefined;
    const target = mapKeySchema(prop, key);
    if (kind === 'const') setMapKeyLeaf(field, key, { kind: 'const', value: '' });
    else if (kind === 'meta') {
      const dm = defaultMeta(target);
      setMapKeyLeaf(field, key, { kind: 'meta', ...(dm !== undefined ? { meta: dm } : {}) });
    }
    else setMapKeyLeaf(field, key, { kind: 'path', path: '' });
  }
  function addMapKey(field: string, key: string): void {
    if (!key || mapEntriesOf(field)[key] !== undefined) return;
    setMapEntries(field, { ...mapEntriesOf(field), [key]: { kind: 'path', path: '' } });
  }

  const editable = $derived(!readonly && !disabled);

  /** Optional-fields accordion — opens the moment ANY optional field
   *  carries a value at any level (restored draft, seeded template rows,
   *  fresh edits), never auto-collapses: folding a populated section is
   *  the user's call and it stays folded until the values come back. */
  let optionalOpen = $state('');
  let prevHasOptional = false;
  $effect(() => {
    const has = optionalFields.some(([f]) => entryOf(f) !== undefined);
    if (has && !prevHasOptional) optionalOpen = 'optional';
    prevHasOptional = has;
  });
</script>

{#snippet hintList(issues: FieldIssue[])}
  <!-- `FieldIssue.message` is the `key|{jsonParams}` i18n carrier — the
       identical decode TranslatedFormFieldErrors runs on field errors:
       a non-key string passes $t through unchanged (legacy/raw). -->
  {#each issues as i (i.path + i.code + i.message)}
    {@const msg = i.message.includes('|')
      ? (() => { const [k, p] = i.message.split('|', 2);
          try { return $t(k, JSON.parse(p) as Record<string, unknown>); } catch { return $t(k); } })()
      : $t(i.message)}
    <p class="mt-1 text-xs font-medium text-destructive" data-testid="payload-map-issue">
      <!-- `required` speaks bare — the message already says what is
           missing ("Pick a source property…"); a "Required —" prefix is
           noise. Value errors keep the "Invalid value —" disambiguator. -->
      {i.code === 'required' ? msg : $t('app.widgets.payload_map.issue.invalid', { message: msg })}
    </p>
  {/each}
{/snippet}

{#snippet leafValue(
  entry: PayloadMapLeafEntry | PayloadMapItemEntry | undefined,
  prop: JsonSchema | undefined,
  opts: {
    /** Field whose `x_options`/`enum` feed const pickers — unset inside
     *  map values (the field's catalog doesn't apply per-key). */
    field?: string;
    /** Standard invalid state (`aria-invalid` → destructive gradient
     *  ring) — conformance issue on THIS input's value. */
    invalid?: boolean;
    /** The DESTINATION schema this leaf must satisfy — drives the path
     *  picker's compatibility partition (`pathCompatible` in core). */
    targetProp?: JsonSchema;
    /** Scoped data-testid for the path picker — the footer's reveal
     *  toggle derives `<testid>-toggle-disabled` from it. */
    testid?: string;
    onLeaf: (leaf: PayloadMapLeafEntry) => void;
    onInject?: (inject: PayloadInjector) => void;
  },
)}
  {@const field = opts.field}
  {@const constTestId = field ? `payload-map-const-${field}` : opts.testid ? `${opts.testid}-const` : undefined}
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
        aria-invalid={opts.invalid || undefined}
        data-testid={constTestId}
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
        aria-invalid={opts.invalid || undefined}
        data-testid={constTestId}
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
        aria-invalid={opts.invalid || undefined}
        data-testid={constTestId}
        onChange={(v) => editable && opts.onLeaf({ kind: 'const', value: String(v) })}
      />
    {:else}
      <TextInput
        value={constText(entry)}
        readonly={!editable}
        aria-invalid={opts.invalid || undefined}
        data-testid={constTestId}
        oninput={(e) => editable && opts.onLeaf({ kind: 'const', value: coerceConst(e.currentTarget.value, prop) })}
      />
    {/if}
  {:else if entry?.kind === 'path'}
    {#if pathTree.length > 0}
      {@const tp = opts.targetProp}
      <PropNavigator
        nodes={pathTree}
        value={entry.path}
        isSelectable={tp ? (n) => fieldPathCompatible(tp, n) : undefined}
        isOptionDisabled={tp ? (n) => !fieldPathCompatible(tp, n) : undefined}
        disabledToggle={!!tp}
        placeholder="$.field.path"
        disabled={!editable}
        aria-invalid={opts.invalid || undefined}
        data-testid={opts.testid}
        onSelect={(path) => editable && opts.onLeaf({ kind: 'path', path })}
      />
    {:else}
      <TextInput
        value={entry.path}
        readonly={!editable}
        placeholder="$.field.path"
        aria-invalid={opts.invalid || undefined}
        data-testid={opts.testid}
        oninput={(e) => editable && opts.onLeaf({ kind: 'path', path: e.currentTarget.value })}
      />
    {/if}
  {:else if entry?.kind === 'meta'}
    <ComboSelect
      mode="single"
      value={entry.meta ?? ''}
      options={META_OPTIONS}
      valueField="value"
      labelField="label"
      iconField="_icon"
      disabled={!editable}
      aria-invalid={opts.invalid || undefined}
      isOptionDisabled={(o) => {
        const rec = o as { _schema?: Record<string, unknown> };
        return !!opts.targetProp && !pathCompatible(opts.targetProp as Record<string, unknown>, rec._schema);
      }}
      disabledToggle
      data-testid={opts.testid ? `${opts.testid}-meta` : undefined}
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
      aria-invalid={opts.invalid || undefined}
      data-testid={opts.testid ? `${opts.testid}-inject` : undefined}
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
        <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] items-start gap-2">
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
              data-testid={`payload-map-kind-${field}-fallback-${i}`}
              onChange={(v) => editable && setClauseKind(field, i, String(v))}
            />
          </div>
          <div class="flex min-w-0 items-start gap-1">
            <div class="min-w-0 flex-1">
              {@render leafValue(clause, undefined, {
                field,
                invalid: clauseIssues(field, i).length > 0,
                targetProp: targetSchema?.properties?.[field],
                testid: `payload-map-path-${field}-fallback-${i}`,
                onLeaf: (leaf) => setClauseItem(field, i, leaf),
              })}
              {@render hintList(clauseIssues(field, i))}
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
  {@const issues = fieldIssues.get(field) ?? []}
  {@const ti = typeIcon(prop)}
  <div class="px-3 py-2" data-testid={`payload-map-row-${field}`}>
    <!-- name · source · value — name wraps, combo fits its cell -->
    <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] items-start gap-2">
      <div class="min-w-0">
        <span class="inline-flex items-center gap-1 font-mono text-xs break-all leading-tight" title={field}>
          <DynamicIcon name={ti._icon} size={13} class={cn("shrink-0 text-muted-foreground", ti._icon_dashed && "[&_path]:[stroke-dasharray:3_1.5]")} />
          {#if effectiveRequired.has(field)}
            <span class="text-destructive" title={$t('app.widgets.payload_map.required')}>*</span>
          {/if}{field}
          <!-- Help text: `x_help_key` is the i18n lane (service-shipped
               dictionary); the raw `description` is the English fallback. -->
          {#if prop[PAYLOAD_X_HELP_KEY] || prop.description}
            <FormLabelWithPriorityHelp
              text={typeof prop[PAYLOAD_X_HELP_KEY] === 'string' ? $t(prop[PAYLOAD_X_HELP_KEY] as string) : prop.description}
              priority="INFORMATION" />
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
          aria-invalid={!entry && issues.length > 0 ? true : undefined}
          data-testid={`payload-map-kind-${field}`}
          onChange={(v) => editable && setKind(field, String(v), prop)}
        />
        {#if !entry}
          {@render hintList(issues)}
        {/if}
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
            aria-invalid={itemIssues(field).length > 0 || leafIssues(field).length > 0 || undefined}
            data-testid={`payload-map-list-${field}`}
            isValueInvalid={(v) =>
              jsonSchemaCheck(v, (prop.items ?? {}) as Record<string, unknown>).length > 0}
            onChange={(v) => editable && setItems(field, [
              ...itemsOf(field).filter((it) => it.kind !== 'const'),
              ...(Array.isArray(v) ? v : []).map((s) => ({ kind: 'const' as const, value: s })),
            ])}
          />
          {@render hintList([...leafIssues(field), ...itemIssues(field)])}
        {:else if entry?.kind === 'map'}
          <!-- The map editor lives on its own full-width row (below the
               grid — same placement contract as fallback clauses) so each
               key row gets real room. Cell 3 only carries the blocked
               dependency hint. -->
          {@const blocked = mapBlockedFrom(prop)}
          {#if blocked}
            <p class="text-xs text-muted-foreground" data-testid={`payload-map-blocked-${field}`}>
              {$t('app.widgets.payload_map.map_blocked', { field: blocked })}
            </p>
          {/if}
        {:else}
          {@render leafValue(entry, prop, {
            field,
            invalid: !!entry && leafIssues(field).length > 0,
            targetProp: prop,
            testid: `payload-map-path-${field}`,
            onLeaf: (leaf) => setPrimaryLeaf(field, leaf),
            onInject: (inject) => {
              const fb = fallbackOf(entryOf(field));
              writeEntry(field, { kind: 'inject', inject, ...(fb ? { fallback: fb } : {}) });
            },
          })}
          {#if entry}
            {@render hintList(leafIssues(field))}
          {/if}
        {/if}
      </div>
    </div>
    {#if entry?.kind === 'map'}
      {@const blocked = mapBlockedFrom(prop)}
      {@const decls = mapKeyDecls(prop)}
      {@const optionalKeys = Object.entries(decls).filter(([k, d]) => !d.required && !(k in entry.entries))}
      <div class="mt-2 space-y-1 border-t border-dashed border-border pt-2" data-testid={`payload-map-mapblock-${field}`}>
        <!-- Same 3-column anatomy as the parent field row: key identity
             (icon·label·help) | source kind | value. -->
        {#each Object.entries(entry.entries) as [key, sub] (key)}
          {@const kd = decls[key]}
          {@const kti = typeIcon(kd?.schema as JsonSchema | undefined)}
          <!-- Same 3-column anatomy as the parent field row and the
               fallback clauses: key identity | source kind | value — the
               trash CTA lives INSIDE the value cell (same placement as
               the clause cluster), never a 4th column. -->
          <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] items-start gap-2" data-testid={`payload-map-maprow-${field}-${key}`}>
            <div class="min-w-0">
              <span class="inline-flex items-center gap-1 pt-1.5 font-mono text-xs break-all leading-tight" title={key}>
                <DynamicIcon name={kti._icon} size={13} class={cn("shrink-0 text-muted-foreground", kti._icon_dashed && "[&_path]:[stroke-dasharray:3_1.5]")} />
                {#if kd?.required}<span class="text-destructive" title={$t('app.widgets.payload_map.required')}>*</span>{/if}{key}
                {#if kd?.description}<FormLabelWithPriorityHelp text={kd.description} priority="INFORMATION" />{/if}
              </span>
            </div>
            <div class="min-w-0">
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
                placeholder={$t('app.widgets.payload_map.source_placeholder')}
                searchable={false}
                disabled={!editable || blocked !== null}
                data-testid={`payload-map-kind-${field}-${key}`}
                onChange={(v) => editable && setMapKeyKind(field, key, String(v))}
              />
            </div>
            <div class="flex min-w-0 items-start gap-1">
              <div class="min-w-0 flex-1">
                {@render leafValue(sub, mapKeySchema(prop, key), {
                  invalid: keyIssues(field, key).length > 0,
                  targetProp: mapKeySchema(prop, key),
                  testid: `payload-map-path-${field}-${key}`,
                  onLeaf: (leaf) => setMapKeyLeaf(field, key, leaf),
                  onInject: (inject) => setMapKey(field, key, { kind: 'inject', inject }),
                })}
                {@render hintList(keyIssues(field, key))}
              </div>
              <!-- Required declared keys can't be removed — the template
                   needs them. -->
              {#if editable && !kd?.required}
                <button type="button" class="rounded p-1.5 text-destructive hover:bg-destructive/10 shrink-0" title={$t('app.common.delete')} onclick={() => setMapKey(field, key, undefined)}>
                  <DynamicIcon name="trash" size={18} />
                </button>
              {/if}
            </div>
          </div>
        {/each}
        <!-- Structural issues (`required`/`schema_mismatch`) drive
             aria-invalid + the Save gate but render no text — the red
             controls already communicate the state. -->
        {@render hintList(leafIssues(field))}
        <!-- Optional declared keys — the field-level accordion principle
             mirrored inside the map: collapsed, each row commits into the
             main list on its first kind pick. -->
        {#if optionalKeys.length > 0}
          <Accordion.Root type="single" class="rounded-md border border-dashed" data-testid={`payload-map-mapopt-${field}`}>
            <Accordion.Item value="keys" class="border-0">
              <Accordion.Trigger class="px-2 py-1 text-xs text-muted-foreground">
                {$t('app.widgets.payload_map.map.optional_keys', { count: optionalKeys.length })}
              </Accordion.Trigger>
              <Accordion.Content class="pb-1">
                {#each optionalKeys as [key, d] (key)}
                  {@const oti = typeIcon(d.schema as JsonSchema)}
                  <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] items-start gap-2 px-1 py-0.5">
                    <div class="min-w-0">
                      <span class="inline-flex items-center gap-1 pt-1.5 font-mono text-xs break-all leading-tight" title={key}>
                        <DynamicIcon name={oti._icon} size={13} class={cn("shrink-0 text-muted-foreground", oti._icon_dashed && "[&_path]:[stroke-dasharray:3_1.5]")} />
                        {key}
                        {#if d.description}<FormLabelWithPriorityHelp text={d.description} priority="INFORMATION" />{/if}
                      </span>
                    </div>
                    <div class="min-w-0">
                      <ComboSelect
                        mode="single"
                        value=""
                        options={LEAF_KIND_OPTIONS}
                        valueField="value"
                        labelField="label"
                        iconField="_icon"
                        iconColorField="_icon_color"
                        placeholder={$t('app.widgets.payload_map.source_placeholder')}
                        searchable={false}
                        disabled={!editable || blocked !== null}
                        data-testid={`payload-map-kind-${field}-${key}`}
                        onChange={(v) => editable && setMapKeyKind(field, key, String(v))}
                      />
                    </div>
                    <div></div>
                  </div>
                {/each}
              </Accordion.Content>
            </Accordion.Item>
          </Accordion.Root>
        {/if}
        {#if editable && Object.keys(decls).length === 0}
          <!-- Free maps only: with a resolved `x_map_keys` declaration
               the key vocabulary is CLOSED — required keys are seated
               rows, optional ones live in their accordion, and a
               template never uses undeclared keys. Here the key picker
               sits in the IDENTITY cell (the slot the committed row's
               icon·label·help occupies); kind and value stay empty
               until a key is chosen. `allowCreate` keeps arbitrary keys
               possible for free maps. -->
          {@const keyOpts = mapKeyOptions(prop).filter((o) => !(o.value in entry.entries))}
          <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] items-start gap-2" data-testid={`payload-map-mapkey-add-${field}`}>
            <div class="min-w-0">
              <ComboSelect
                mode="single"
                value=""
                options={keyOpts}
                valueField="value"
                labelField="label"
                secondaryField="_sub"
                iconField="_icon"
                iconDashedField="_icon_dashed"
                display="detailed"
                placeholder={$t('app.widgets.payload_map.map.add_key')}
                allowCreate
                disabled={blocked !== null}
                aria-invalid={leafIssues(field).length > 0 || undefined}
                onChange={(v) => editable && addMapKey(field, String(v))}
              />
            </div>
            <div></div>
            <div></div>
          </div>
        {/if}
      </div>
    {/if}
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
      <Accordion.Root type="single" bind:value={optionalOpen} class="rounded-md border" data-testid="payload-map-optional">
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
