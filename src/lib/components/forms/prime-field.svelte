<script lang="ts">
  /**
   * PrimeField — standalone field-row wrapper for controls NOT inside a
   * superforms/formsnap `FormField` (config rows, dynamic meta rows,
   * settings widgets, sheet-panel quick forms).
   *
   * Anatomy (two layouts, same chrome as the established pages):
   *
   *   layout="stacked" (default)          layout="inline" (bool controls)
   *   ┌────────────────────────┐          ┌────────────────────────┐
   *   │ LABEL [req *] [?help]  │          │ CONTROL LABEL [?help]  │
   *   │ CONTROL                │          │ (switch/checkbox/…)    │
   *   │ error                  │          │ error                  │
   *   └────────────────────────┘          └────────────────────────┘
   *
   * The `control` snippet always receives `id` — render a real
   * `<label for>`/`id` pair. For superforms pages use the FormField
   * family (`FormField`/`FormControl`) instead.
   *
   *   <PrimeField id="cfg-foo" label={$t('…')} help={{ text: $t('…') }}>
   *     {#snippet control({ id })}
   *       <Input {id} bind:value={v} />
   *     {/snippet}
   *   </PrimeField>
   */
  import { getT } from '../../bridges.js';
  import { cn } from '../../utils/index.js';
  import FormLabelWithPriorityHelp from './FormLabelWithPriorityHelp.svelte';
  import DynamicIcon from '../dynamic-icon/DynamicIcon.svelte';
  import {
    resolveFieldHelp,
    type HelpContext,
    type PrimeFieldHelp,
  } from './resolve-field-help.js';
  import type { Snippet } from 'svelte';

  const t = getT();

  let {
    id: idProp,
    label,
    icon,
    required = false,
    hint,
    error,
    help,
    help_context = 'form',
    layout = 'stacked',
    control,
    class: className,
    'data-testid': dataTestId,
  }: {
    /** Control id — defaults to a stable per-instance `$props.id()`. */
    id?: string;
    /** Translated label text. Omit for label-less rows (switch-only, etc.). */
    label?: string;
    /** Lucide icon name rendered before the label (the field's semantic
     *  marker — `MetaColumn.icon` on list-surface labels). */
    icon?: string;
    /** Append the required `*` marker. */
    required?: boolean;
    /**
     * Translated hint line under the control (`text-xs text-muted-foreground`).
     * @deprecated Inline hints are deprecated — use `help` (label tooltip)
     * instead. See docs/ai/input-anatomy.md "Field hints".
     */
    hint?: string;
    /** Translated error line(s) under the control (`text-destructive`). */
    error?: string | string[];
    /**
     * Tooltip help — pre-mapped `{ text, priority?, title?, labelKey? }` or
     * raw `MetaColumn` (`tooltip`, `tooltip_priority`, `tooltip_title`,
     * `show_form_tooltip` / `show_list_tooltip`).
     */
    help?: PrimeFieldHelp;
    /**
     * Which surface flag gates a `MetaColumn`-shaped `help`: `'form'` reads
     * `show_form_tooltip`, `'list'` reads `show_list_tooltip`. Ignored for
     * pre-mapped `FieldHelp`. Default `'form'`.
     */
    help_context?: HelpContext;
    /** `'stacked'` (label above) or `'inline'` (bool controls — label beside control). */
    layout?: 'stacked' | 'inline';
    /** The control — receives `{ id }` and MUST apply it for label wiring. */
    control: Snippet<[{ id: string }]>;
    class?: string;
    'data-testid'?: string;
  } = $props();

  // `$props.id()` must be a top-level variable initializer — gives a stable,
  // hydration-safe per-instance id when the caller does not provide one.
  const generatedId = $props.id();
  const id = $derived(idProp ?? generatedId);

  const resolvedHelp = $derived.by(() =>
    resolveFieldHelp(help, help_context, (key) => $t(key)),
  );

  const errors = $derived(
    error === undefined ? [] : Array.isArray(error) ? error : [error],
  );
</script>

{#snippet helpIcon()}
  {#if resolvedHelp}
    <FormLabelWithPriorityHelp
      text={resolvedHelp.text}
      priority={resolvedHelp.priority}
      title={resolvedHelp.title}
      labelKey={resolvedHelp.labelKey}
    />
  {/if}
{/snippet}

{#snippet labelEl()}
  {#if label}
    {#if icon}<DynamicIcon name={icon} size={14} class="inline-block opacity-70" />{/if}
    {label}{#if required}<span class="text-destructive">*</span>{/if}{@render helpIcon()}
  {/if}
{/snippet}

<div class={cn('space-y-2', className)} data-testid={dataTestId}>
  {#if layout === 'inline'}
    <div class="flex items-center gap-2">
      {@render control({ id })}
      {#if label}
        <label
          for={id}
          class="inline-flex items-center gap-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {@render labelEl()}
        </label>
      {/if}
    </div>
  {:else}
    {#if label}
      <label for={id} class="inline-flex items-center gap-1 text-sm font-medium">
        {@render labelEl()}
      </label>
    {/if}
    {@render control({ id })}
  {/if}

  {#if hint}
    <p class="text-xs text-muted-foreground">{hint}</p>
  {/if}
  {#each errors as err (err)}
    <p class="text-xs font-medium text-destructive">{err}</p>
  {/each}
</div>
