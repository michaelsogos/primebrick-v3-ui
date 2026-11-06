<script lang="ts" module>
	import type { KbdSize, KbdTone } from '../kbd/index.js';
	import type { Component } from 'svelte';

	/**
	 * One hint = a group of Kbd chips + an optional translated label.
	 *   { keys: ['↑','↓'], label: 'Move' } → [↑][↓] Move
	 *   { keys: ['esc'], size: 'modifier', label: 'Close' } → [esc] Close
	 *   { keys: [ChevronUp, ChevronDown], label: 'Page' } → [▲][▼] Page
	 *   { keys: [{label:'Pag.',glyph:'↑'}], label: 'Page' } → [Pag. ↑] Page
	 * A key may be a string glyph, an icon component, or a {label,glyph}
	 * pair — icons render in 'icon' chips ('icon-lg' when the hint size is
	 * a *-lg variant); {label,glyph} pairs render the label at chip size
	 * with the glyph enlarged.
	 */
	export type KeyboardHintKey = string | Component | { label: string; glyph: string };

	export interface KeyboardHint {
		/** Kbd chips rendered adjacent — strings as glyphs, components as icons. */
		keys: KeyboardHintKey[];
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
		tone = 'default',
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLElement>, HTMLElement> & {
		/** Ordered hint groups — keys first, translated label after. */
		hints: KeyboardHint[];
		/** Optional trailing content pinned to the far right. */
		end?: Snippet;
		/** Chip tone — 'inverted' when rendered on the dark tooltip surface. */
		tone?: KbdTone;
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
			{#each hint.keys as key, j (j)}
				{#if typeof key === 'string'}
					<Kbd size={hint.size ?? 'key'} {tone}>{key}</Kbd>
				{:else if typeof key === 'function'}
					{@const Icon = key}
					<Kbd size={hint.size?.endsWith('-lg') ? 'icon-lg' : 'icon'} {tone}><Icon /></Kbd>
				{:else}
					<Kbd size={hint.size ?? 'key'} {tone}>{key.label}<span class="ms-1 text-base leading-none">{key.glyph}</span></Kbd>
				{/if}
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
