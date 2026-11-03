<script lang="ts">
	import type { PropNavNode } from './prop-nav.types.js';

	let {
		chain,
		pathLabel,
		pathMono,
		rootLabel,
	}: {
		chain: PropNavNode[];
		/** Label per segment — defaults to the node's own `label`. */
		pathLabel?: (node: PropNavNode) => string;
		/** Mono line per node — defaults to the full `value` path. */
		pathMono?: (node: PropNavNode) => string;
		/** First line when nothing is selected/hovered yet. */
		rootLabel?: string;
	} = $props();

	const labelLine = $derived(
		chain.length === 0
			? (rootLabel ?? '$')
			: chain.map((n) => pathLabel?.(n) ?? n.label).join(' › '),
	);
	const monoLine = $derived(
		chain.length === 0 ? undefined : (pathMono?.(chain[chain.length - 1]) ?? chain[chain.length - 1].value),
	);
</script>

<!-- The mono line is ALWAYS rendered — a conditional mount made the
     header jump from 1 to 2 lines on the first hover, flickering the
     whole panel. nbsp reserves the same height invisibly. -->
<div class="border-b border-border bg-muted/40 px-3 py-1.5" data-propnv-header>
	<div class="truncate text-sm font-medium">{labelLine}</div>
	<div class="truncate font-mono text-[11px] text-muted-foreground">{monoLine ?? ' '}</div>
</div>
