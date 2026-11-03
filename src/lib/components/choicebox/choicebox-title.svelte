<script lang="ts">
	/**
	 * Choicebox.Title — the card's heading line (`h3`, semibold).
	 */
	import { cn } from '../../utils/index.js';
	import type { Snippet } from 'svelte';

	let { class: className, children }: { class?: string; children: Snippet } = $props();
</script>

<h3 class={cn('font-semibold leading-none tracking-tight', className)}>
	{@render children()}
</h3>
