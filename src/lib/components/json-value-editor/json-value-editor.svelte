<script lang="ts">
  /**
   * JsonValueEditor — the canonical JSON value control: collapsible PREVIEW
   * (read-only `JsonCodeBlock`) ⇄ EDIT (`JsonEditor` with schema-aware
   * lint/completion), toggled from a toolbar that also hosts the optional
   * AI-assist CTA.
   *
   * Contract (mirrors the config-builder's JsonPreviewEditor anatomy):
   * - toolbar ABOVE the surface: collapse toggle on the left, preview⇄edit
   *   switch + AI CTA on the right — always visible, never overlaying text.
   * - `on_ai_assist` is injected by the host (openSheet is host-coupled);
   *   absent → no AI CTA. The host wires it to the generic JSON AI panel.
   * - `value` is the user-authored JSON TEXT (whatever formatting they
   *   typed); the caller parses on submit. Preview pretty-prints the parsed
   *   value; unparseable input previews the raw string.
   * - `readonly`/`disabled` → preview only, no edit switch.
   *
   * Wrappable by FormField/PrimeField — it renders ONLY the control;
   * label/tooltip/errors stay the wrapper's job.
   */
  import { cn } from '../../utils/index.js';
  import { getT } from '../../bridges.js';
  import { Pencil, Eye } from '@primebrick/ui/vendor/lucide';
  import JsonEditor from '../json-code-block/json-editor.svelte';
  import JsonCodeBlock from '../json-code-block/json-code-block.svelte';
  import AiIcon from '../ai-icon/ai-icon.svelte';

  const t = getT();

  let {
    value = $bindable(''),
    schema,
    minRows = 10,
    maxHeight = '24rem',
    placeholder,
    readonly = false,
    disabled = false,
    on_ai_assist,
    ai_label,
    class: className,
    ...rest
  }: {
    /** User-authored JSON text (bindable). */
    value?: string;
    /** Optional JSON Schema → edit-mode lint/completion. */
    schema?: Record<string, unknown>;
    /** Minimum visible rows (row = 1.25rem at text-xs). Default 10. */
    minRows?: number;
    /** CSS max-height of the scrollable surface. Default '24rem'. */
    maxHeight?: string;
    placeholder?: string;
    readonly?: boolean;
    disabled?: boolean;
    /** Host-injected AI-assist opener — the CTA renders only when set. */
    on_ai_assist?: () => void;
    /** Localized aria/title for the AI CTA (host injects `app.smart.json.ai.brainCta`). */
    ai_label?: string;
  } & import('svelte/elements').HTMLAttributes<HTMLDivElement> = $props();

  let previewOpen = $state(true);
  let editing = $state(false);

  const editable = $derived(!readonly && !disabled);

  // Preview content: pretty-printed when parseable, the raw string when not.
  const previewJson = $derived.by(() => {
    try {
      return JSON.parse(value || 'null');
    } catch {
      return value;
    }
  });

  // Parse diagnostic surfaced under the editor in edit mode — the CodeMirror
  // lint already underlines the error; this line makes it screen-reader and
  // form-validation visible (matches JsonPreviewEditor's rawJsonError line).
  const parseError = $derived.by(() => {
    const v = value?.trim();
    if (!v || !editing) return '';
    try {
      JSON.parse(v);
      return '';
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  });
</script>

<div class={cn('space-y-1', className)} {...rest}>
  <!-- Toolbar: collapse toggle (left) + preview⇄edit + AI CTA (right) -->
  <div class="flex items-center justify-between">
    <button
      type="button"
      class="text-xs text-muted-foreground hover:text-foreground"
      onclick={() => (previewOpen = !previewOpen)}
      data-testid="json-value-preview-toggle"
    >
      {previewOpen ? '▼' : '▶'} {$t('app.widgets.json.preview')}
    </button>
    <div class="flex items-center gap-2">
      {#if editable}
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          onclick={() => (editing = !editing)}
          title={$t('app.widgets.json.editMode')}
          data-testid="json-value-edit-toggle"
        >
          {#if editing}
            <Eye class="h-3.5 w-3.5" />
          {:else}
            <Pencil class="h-3.5 w-3.5" />
          {/if}
          {$t('app.common.edit')}
        </button>
      {/if}
      {#if on_ai_assist}
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-accent transition-colors"
          onclick={on_ai_assist}
          title={ai_label ?? $t('app.smart.json.ai.brainCta')}
          aria-label={ai_label ?? $t('app.smart.json.ai.brainCta')}
          data-testid="json-value-ai-cta"
        >
          <AiIcon size={16} />
        </button>
      {/if}
    </div>
  </div>

  {#if previewOpen}
    {#if editing && editable}
      <JsonEditor
        bind:value
        {schema}
        {minRows}
        {maxHeight}
        {placeholder}
        data-testid="json-value-editor-cm"
      />
      {#if parseError}
        <p class="text-destructive text-xs" data-testid="json-value-parse-error">{parseError}</p>
      {/if}
    {:else}
      <JsonCodeBlock
        code={previewJson}
        lineNumbers
        copyable
        {minRows}
        {maxHeight}
        data-testid="json-value-preview"
      />
    {/if}
  {/if}
</div>
