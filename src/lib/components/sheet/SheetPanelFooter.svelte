<script lang="ts">
  /**
   * SheetPanelFooter — the canonical FOOT content for commit-strip panels.
   * The gray strip itself (`border-t bg-muted/50`) is owned by
   * `SheetPanelLayout`; this supplies the INNER anatomy shared with
   * DialogFooter/FormPageLayout/popover commit bars:
   *
   *   p-3 · right-aligned button group · natural-width CTAs (never w-full)
   *
   * Optional `start` snippet for left-side content (KeyboardHints legend,
   * meta text). Input-box feet (chat panels) do NOT use this — they supply
   * their own padded container.
   */
  import { cn, type WithElementRef } from '../../utils/index.js';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';

  let {
    ref = $bindable(null),
    class: className,
    children,
    start,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    /** Left-side content — KeyboardHints legend, meta text. */
    start?: Snippet;
    children?: Snippet;
  } = $props();
</script>

<div
  bind:this={ref}
  class={cn('flex items-center gap-2 p-3', className)}
  {...restProps}
>
  {@render start?.()}
  <div class="ml-auto flex items-center gap-2">
    {@render children?.()}
  </div>
</div>
