<script lang="ts">
	/**
	 * Choicebox.Description — muted supporting line under the title.
	 */
	import { cn } from '../../utils/index.js';
	import type { Snippet } from 'svelte';

	let { class: className, children }: { class?: string; children: Snippet } = $props();
</script>

<p class={cn('text-sm text-muted-foreground leading-normal', className)}>
	{@render children()}
</p>
