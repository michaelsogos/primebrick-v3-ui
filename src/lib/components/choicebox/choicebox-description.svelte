<script lang="ts">
	/**
	 * Choicebox.Description — muted supporting line under the title,
	 * one size down from the title for a clear type hierarchy.
	 */
	import { cn } from '../../utils/index.js';
	import type { Snippet } from 'svelte';

	let { class: className, children }: { class?: string; children: Snippet } = $props();
</script>

<p class={cn('text-xs text-muted-foreground leading-normal', className)}>
	{@render children()}
</p>
