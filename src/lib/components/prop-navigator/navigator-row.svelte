<script lang="ts">
	import { cn } from '../../utils/index.js';
	import DynamicIcon from '../dynamic-icon/DynamicIcon.svelte';
	import { menuListHoverNeutral, menuListSelectedSurfaceDropdownClasses } from '../menu-row-chrome.js';
	import { ChevronRight } from '../../vendor/lucide.js';
	import type { PropNavNode } from './prop-nav.types.js';
	import type { usePropNavigation } from '../../composables/use-prop-navigation.svelte.js';

	let {
		node,
		col,
		idx,
		nav,
		chain,
		selectedValue,
	}: {
		node: PropNavNode;
		col: number;
		idx: number;
		nav: ReturnType<typeof usePropNavigation>;
		/** Ancestor chain ending at this node — drives the header hover preview. */
		chain: PropNavNode[];
		selectedValue?: string;
	} = $props();

	const navigable = $derived(nav.isNavigable(node));
	const isDisabled = $derived(nav.disabled(node));
	const selected = $derived(selectedValue === node.value);
</script>

<!-- shrink-0: inside the column flex-box an overflowing set would
     otherwise SQUEEZE h-9 rows to min-content instead of scrolling —
     the row height must stay 36px and the column scrolls. -->
<div
	role="option"
	aria-selected={selected}
	aria-disabled={isDisabled && !navigable ? true : undefined}
	tabindex={nav.colFocusIdx[col] === idx ? 0 : -1}
	data-propnv-row
	data-propnv-path={node.value}
	title={node.value}
	class={cn(
		'flex h-9 w-full shrink-0 cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 text-left text-sm outline-hidden select-none touch-manipulation focus-visible:ring-2 focus-visible:ring-ring',
		menuListHoverNeutral,
		selected && menuListSelectedSurfaceDropdownClasses,
		isDisabled && 'opacity-50',
	)}
	onfocus={() => {
		nav.trackFocus(col, idx);
		if (navigable) nav.descend(node, col);
	}}
	onmouseenter={() => nav.setHover(chain)}
	onclick={() => nav.activate(node, col)}
	onkeydown={(e) => nav.handleRowKeydown(e, node, col, idx)}
>
	<div class="flex size-5 shrink-0 items-center justify-center">
		{#if node._icon}
			<DynamicIcon
				name={node._icon}
				size={14}
				class={cn('text-muted-foreground', node._icon_dashed && '[&_path]:[stroke-dasharray:3_1.5]')}
			/>
		{/if}
	</div>
	<span class="min-w-0 flex-1 truncate">{node.label}</span>
	{#if node._sub}
		<span class="shrink-0 truncate text-[10px] text-muted-foreground">{node._sub}</span>
	{/if}
	{#if navigable}
		<!-- Descend chevron only — container commits go through Enter
		     (footer hint) or the picker-level commit affordance; the
		     inline check CTA is dead chrome (bits-ui tick ban). -->
		<ChevronRight class="ms-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
	{/if}
</div>
