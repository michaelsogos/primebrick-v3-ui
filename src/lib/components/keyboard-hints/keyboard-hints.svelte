<script lang="ts" module>
	import type { KbdSize } from '../kbd/index.js';

	/**
	 * One hint = a group of Kbd chips + an optional translated label.
	 *   { keys: ['↑','↓'], label: 'Move' } → [↑][↓] Move
	 *   { keys: ['esc'], size: 'modifier', label: 'Close' } → [esc] Close
	 */
	export interface KeyboardHint {
		/** Kbd glyphs rendered as adjacent chips (same size for the group). */
		keys: string[];
		/** Chip size for the group — 'modifier' for esc/ctrl/alt words. */
		size?: KbdSize;
		/** Translated label rendered after the chips. */
		label?: string;
	}
</script>

<script lang="ts">
	/**
	 * KeyboardHints — the canonical keybind legend row.
	 *
	 *   [↑][↓] label · [space] label · [esc] label              [end]
	 *
	 * One component for every surface that lists keyboard shortcuts —
	 * the app-launcher footer and the EntityListTable footer both render
	 * this. The caller owns the outer chrome (border-t, bg, padding) via
	 * `class`; this renders the hints row itself. `end` is an optional
	 * trailing snippet (ms-auto) for toggles like the launcher's
	 * "show all" switch.
	 */
	import type { HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';
	import { cn, type WithElementRef } from '../../utils/index.js';
	import { Kbd } from '../kbd/index.js';

	let {
		ref = $bindable(null),
		class: className,
		hints,
		end,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLElement>, HTMLElement> & {
		/** Ordered hint groups — keys first, translated label after. */
		hints: KeyboardHint[];
		/** Optional trailing content pinned to the far right. */
		end?: Snippet;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="keyboard-hints"
	class={cn('flex items-center gap-3 text-[11px] text-muted-foreground', className)}
	{...restProps}
>
	{#each hints as hint, i (i)}
		<span class="inline-flex items-center gap-1">
			{#each hint.keys as key (key)}
				<Kbd size={hint.size ?? 'key'}>{key}</Kbd>
			{/each}
			{#if hint.label}<span>{hint.label}</span>{/if}
		</span>
	{/each}
	{#if end}
		<div class="ms-auto">
			{@render end()}
		</div>
	{/if}
</div>
