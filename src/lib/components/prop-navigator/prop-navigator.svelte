<script lang="ts">
	/**
	 * PropNavigator — column-picker for schema-driven paths.
	 *
	 * Anatomy (mirrors `SidebarAppLauncher`, translated to the props domain):
	 * - Header: composed label path + mono `$.a.b` line (hover previews).
	 * - Columns: content-fitted in the launcher band (min-w-52 → max 300px,
	 *   then flex-auto to share panel slack); deeper levels materialize
	 *   inside a horizontal scroller that auto-positions on the newest.
	 * - Rows: navigable → descend (row = preview), leaf → commit. A node
	 *   that is BOTH navigable and selectable descends on activate and
	 *   commits via its check CTA / Enter — the two predicates stay
	 *   orthogonal, never conflated.
	 * - Search: non-empty query swaps columns for a flat filtered list
	 *   (type-ahead preserved — "city" finds `$.customer.address.city`).
	 * - Footer: keybinding hints + the `eye-dashed` reveal toggle for the
	 *   disabled partition (same affordance and i18n keys as ComboSelect).
	 *
	 * NOT a ComboSelect feature: the contract differs — ComboSelect picks
	 * a value from a flat candidate set; this descends a tree to commit a
	 * path. ComboSelect stays untouched; consumers keep their trigger
	 * chrome contract (`role=combobox`, `aria-invalid`, `data-testid`).
	 */
	import { tick } from 'svelte';
	import { cn } from '../../utils/index.js';
	import * as Popover from '../popover/index.js';
	import DynamicIcon from '../dynamic-icon/DynamicIcon.svelte';
	import { ChevronDown, ChevronsUpDown, Eraser, Search } from '../../vendor/lucide.js';
	import { menuListHoverNeutral, menuListSelectedSurfaceDropdownClasses } from '../menu-row-chrome.js';
	import { inputTrailingIconColorClasses } from '../input/input-chrome.js';
	import { getT } from '../../bridges.js';
	import { usePropNavigation } from '../../composables/use-prop-navigation.svelte.js';
	import NavigatorHeader from './navigator-header.svelte';
	import NavigatorColumn from './navigator-column.svelte';
	import NavigatorFooter from './navigator-footer.svelte';
	import type { PropNavNode } from './prop-nav.types.js';

	const t = getT();

	let {
		nodes,
		value = '',
		onSelect,
		isSelectable,
		isOptionDisabled,
		disabledToggle = false,
		pathLabel,
		pathMono,
		placeholder,
		searchPlaceholder,
		rootLabel,
		disabled = false,
		'aria-invalid': ariaInvalid,
		'aria-describedby': ariaDescribedby,
		'data-testid': dataTestId,
		class: className,
	}: {
		nodes: PropNavNode[];
		value?: string;
		onSelect: (path: string) => void;
		/** Whether a node may be committed — default: leafs only. */
		isSelectable?: (n: PropNavNode) => boolean;
		/** Incompatible marker — disabled nodes can't commit but may still
		 *  be descended into (containers stay reachable). */
		isOptionDisabled?: (n: PropNavNode) => boolean;
		/** Enables the eye-dashed reveal toggle in the footer. */
		disabledToggle?: boolean;
		pathLabel?: (node: PropNavNode) => string;
		pathMono?: (node: PropNavNode) => string;
		placeholder?: string;
		searchPlaceholder?: string;
		/** Header's first line before any selection. */
		rootLabel?: string;
		disabled?: boolean;
		'aria-invalid'?: boolean;
		'aria-describedby'?: string;
		'data-testid'?: string;
		class?: string;
	} = $props();

	let open = $state(false);
	let search = $state('');
	let showDisabled = $state(false);
	let searchListEl = $state<HTMLDivElement | null>(null);
	let triggerEl = $state<HTMLElement | null>(null);
	let contentEl = $state<HTMLElement | null>(null);

	/** Horizontal alignment: `start` hugs the trigger's left edge, `end`
	 *  hugs its right edge when the panel can't fit between trigger and
	 *  the viewport's right edge. The panel is content-fitted (columns
	 *  13rem→300px each) and WIDENS as the user drills down — the fit
	 *  check must be re-evaluated on every panel resize, not just at
	 *  open, or a deep column set slides out of the viewport. */
	let align = $state<'start' | 'end'>('start');
	const VIEWPORT_GUTTER_PX = 16;

	function computeAlign() {
		if (!triggerEl) return;
		const panelWidth =
			contentEl?.getBoundingClientRect().width ??
			Math.min(2 * 300, window.innerWidth * 0.8);
		const triggerRect = triggerEl.getBoundingClientRect();
		align = triggerRect.left + panelWidth + VIEWPORT_GUTTER_PX > window.innerWidth ? 'end' : 'start';
	}

	/** Panel width changes while open (column drill-in/out, search
	 *  result list) — keep the anchor edge honest. Window resizes move
	 *  the trigger too, so both signals feed the same recompute. */
	$effect(() => {
		if (!open || !contentEl) return;
		const ro = new ResizeObserver(computeAlign);
		ro.observe(contentEl);
		window.addEventListener('resize', computeAlign);
		return () => {
			ro.disconnect();
			window.removeEventListener('resize', computeAlign);
		};
	});

	const nav = usePropNavigation({
		nodes: () => nodes,
		isSelectable: (n) => isSelectable?.(n) ?? !n.children?.length,
		isDisabled: (n) => isOptionDisabled?.(n) ?? false,
		showDisabled: () => showDisabled,
		onCommit: (path) => {
			onSelect(path);
			open = false;
		},
	});

	/** Walk the tree for the committed node — drives the trigger's icon. */
	function findNode(path: string, level: PropNavNode[] = nodes): PropNavNode | undefined {
		for (const n of level) {
			if (n.value === path) return n;
			const hit = n.children && findNode(path, n.children);
			if (hit) return hit;
		}
		return undefined;
	}
	const selectedNode = $derived(value ? findNode(value) : undefined);

	/** Flat search view — every node whose segment or path matches, with
	 *  the same reveal semantics (disabled leafs hidden unless toggled,
	 *  containers always reachable). */
	const flatResults = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return [];
		const out: { node: PropNavNode; chain: PropNavNode[] }[] = [];
		const walk = (level: PropNavNode[], chain: PropNavNode[]) => {
			for (const n of level) {
				const next = [...chain, n];
				if (n.label.toLowerCase().includes(q) || n.value.toLowerCase().includes(q))
					out.push({ node: n, chain: next });
				if (n.children) walk(n.children, next);
			}
		};
		walk(nodes, []);
		if (showDisabled) return out;
		return out.filter(({ node }) => !nav.disabled(node) || nav.isNavigable(node));
	});

	/** Flat-list activation — selectable commits; otherwise a navigable
	 *  match descends back into column mode at its own depth. */
	function activateFlat(node: PropNavNode, chain: PropNavNode[]) {
		if (nav.selectable(node) && !nav.disabled(node)) {
			onSelect(node.value);
			open = false;
			return;
		}
		if (nav.isNavigable(node)) {
			search = '';
			// Replay the chain so the node lands selected in its column.
			nav.reset(node.value);
		}
	}

	function handleFlatKeydown(e: KeyboardEvent, node: PropNavNode, chain: PropNavNode[]) {
		const rows = searchListEl
			? [...searchListEl.querySelectorAll<HTMLElement>('[data-propnv-flat-row]')]
			: [];
		const idx = rows.indexOf(e.currentTarget as HTMLElement);
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			const next = e.key === 'ArrowDown' ? idx + 1 : idx - 1;
			rows[(next + rows.length) % rows.length]?.focus();
		} else if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			activateFlat(node, chain);
		}
	}

	async function handleOpenChange(next: boolean) {
		if (disabled) return;
		open = next;
		if (next) {
			search = '';
			showDisabled = false;
			nav.reset(value);
			computeAlign();
			await tick();
			computeAlign();
		}
	}
</script>

<Popover.Root {open} onOpenChange={handleOpenChange}>
	<Popover.Trigger>
		{#snippet child({ props: triggerProps })}
			<div
				{...triggerProps}
				bind:this={triggerEl}
				role="combobox"
				tabindex={disabled ? -1 : 0}
				class={cn(
					'relative min-h-9 w-full rounded-md px-3 py-1 text-sm ring-offset-background outline-hidden transition-all',
					'border-primary-gradient bg-background hover:brightness-105',
					'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
					disabled ? 'pointer-events-none cursor-not-allowed opacity-50' : 'cursor-pointer',
					'flex items-center gap-2 text-left',
					'aria-invalid:border-destructive-gradient aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
					className,
				)}
				aria-disabled={disabled || undefined}
				aria-invalid={ariaInvalid}
				aria-describedby={ariaDescribedby}
				data-testid={dataTestId}
			>
				{#if selectedNode}
					{#if selectedNode._icon}
						<DynamicIcon
							name={selectedNode._icon}
							size={16}
							class={cn('shrink-0 text-muted-foreground', selectedNode._icon_dashed && '[&_path]:[stroke-dasharray:3_1.5]')}
						/>
					{/if}
					<span class="flex-1 truncate text-left font-mono text-[13px]">{value}</span>
				{:else if value.trim() !== ''}
					<span class="flex-1 truncate text-left font-mono text-[13px]">{value}</span>
				{:else}
					<span class="flex-1 truncate text-left text-muted-foreground">{placeholder ?? ''}</span>
				{/if}
				<div class="ml-auto flex items-center gap-1 shrink-0">
					{#if !disabled && value}
						<button
							type="button"
							onpointerdown={(e) => e.stopPropagation()}
							onclick={(e) => {
								e.stopPropagation();
								onSelect('');
							}}
							class={inputTrailingIconColorClasses}
							aria-label={$t('app.common.clear_selection')}
							title={$t('app.common.clear_selection')}
						>
							<Eraser />
						</button>
					{/if}
					<ChevronDown class="h-4 w-4 text-muted-foreground" />
				</div>
			</div>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content bind:ref={contentEl} {align} class="w-auto min-w-56 max-w-[80vw] p-0">
		<NavigatorHeader chain={nav.headerChain} {pathLabel} {pathMono} {rootLabel} />

		<!-- Search row — always visible; non-empty swaps columns for the
		     flat filtered view (type-ahead preserved). -->
		<div class="flex items-center gap-2 border-b border-border px-3 py-1.5">
			<Search class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			<!-- // standards-exempt: native-control — borderless inline search row inside the popover chrome -->
			<input
				bind:value={search}
				placeholder={searchPlaceholder ?? $t('app.search.placeholder')}
				class="h-7 w-full bg-transparent text-sm outline-hidden placeholder:text-muted-foreground"
				data-propnv-search
				onkeydown={(e) => {
					if (e.key === 'ArrowDown') {
						e.preventDefault();
						searchListEl?.querySelector<HTMLElement>('[data-propnv-flat-row]')?.focus();
					}
				}}
			/>
		</div>

		{#if search.trim() === ''}
			<!-- Column mode — the scroller hugs the columns (block fill of
			     the shrink-to-fit popover, capped at 80vw); panelEl keeps
			     min-w-max so over-wide column sets become scrollable. -->
			<div
				bind:this={nav.scrollEl}
				role="presentation"
				class="flex w-auto max-w-[80vw] divide-x divide-border overflow-x-auto"
				onmouseleave={() => nav.setHover(null)}
			>
				<div bind:this={nav.panelEl} role="presentation" class="flex h-72 min-w-max divide-x divide-border">
					{#each nav.columns as colRows, col (col)}
						<NavigatorColumn
							{col}
							{nav}
							chain={nav.selectionPath.slice(0, col)}
							selectedValue={value}
							aria-label={$t('app.common.select_value')}
						/>
					{/each}
				</div>
			</div>
		{:else}
			<div
				bind:this={searchListEl}
				class="flex max-h-72 w-auto min-w-[26rem] max-w-[80vw] flex-col gap-0.5 overflow-y-auto p-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
				role="listbox"
				aria-label={$t('app.common.select_value')}
			>
				{#each flatResults as { node, chain } (node.value)}
					{@const isDisabled = nav.disabled(node)}
					{@const isSelected = value === node.value}
					<div
						role="option"
						aria-selected={isSelected}
						aria-disabled={isDisabled && !nav.isNavigable(node) ? true : undefined}
						tabindex="0"
						data-propnv-flat-row
						class={cn(
							'flex h-9 w-full shrink-0 cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 text-left text-sm outline-hidden select-none focus-visible:ring-2 focus-visible:ring-ring',
							menuListHoverNeutral,
							isSelected && menuListSelectedSurfaceDropdownClasses,
							isDisabled && 'opacity-50',
						)}
						onclick={() => activateFlat(node, chain)}
						onkeydown={(e) => handleFlatKeydown(e, node, chain)}
						onmouseenter={() => nav.setHover(chain)}
					>
						{#if node._icon}
							<DynamicIcon
								name={node._icon}
								size={14}
								class={cn('shrink-0 text-muted-foreground', node._icon_dashed && '[&_path]:[stroke-dasharray:3_1.5]')}
							/>
						{/if}
						<span class="min-w-0 flex-1 truncate font-mono text-[12px]">{node.value}</span>
						{#if node._sub}
							<span class="shrink-0 truncate text-[10px] text-muted-foreground">{node._sub}</span>
						{/if}
						{#if nav.isNavigable(node)}
							<ChevronsUpDown class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
						{/if}
					</div>
				{:else}
					<div class="px-3 py-4 text-center text-sm text-muted-foreground">{$t('app.common.no_results')}</div>
				{/each}
			</div>
		{/if}

		<NavigatorFooter bind:showDisabled showReveal={disabledToggle && !!isOptionDisabled} data-testid={dataTestId} />
	</Popover.Content>
</Popover.Root>
