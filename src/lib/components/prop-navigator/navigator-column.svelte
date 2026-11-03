<script lang="ts">
	import NavigatorRow from './navigator-row.svelte';
	import type { PropNavNode } from './prop-nav.types.js';
	import type { usePropNavigation } from '../../composables/use-prop-navigation.svelte.js';

	let {
		col,
		nav,
		chain,
		selectedValue,
		'aria-label': ariaLabel,
	}: {
		col: number;
		nav: ReturnType<typeof usePropNavigation>;
		/** Ancestor chain of the column itself (excludes each row's node). */
		chain: PropNavNode[];
		selectedValue?: string;
		'aria-label'?: string;
	} = $props();

	const rows = $derived(nav.visibleRows(col));
</script>

<!-- Same width band as SidebarAppLauncher: fit-content between
     min-w-52 and 300px, then stretches to share panel slack
     (flex-auto) — labels truncate against the resolved width. Same
     scrollbar contract as the launcher too: nothing reserved when the
     column doesn't overflow, a thin edge-hugging bar when it does —
     the reserved `scrollbar-gutter` was 17px of dead space stolen
     from every column including non-scrolling ones. -->
<div
	class="flex min-w-52 max-w-[300px] flex-auto flex-col gap-0.5 overflow-y-auto p-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
	role="listbox"
	aria-label={ariaLabel}
	data-propnv-col={col}
>
	{#each rows as node, i (node.value)}
		<NavigatorRow {node} {col} idx={i} {nav} chain={[...chain, node]} {selectedValue} />
	{/each}
</div>
