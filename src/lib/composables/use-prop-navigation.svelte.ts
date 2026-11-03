import { tick } from 'svelte';
import type { PropNavNode } from '../components/prop-navigator/prop-nav.types.js';

/**
 * Column-navigation state for `PropNavigator` — the mechanical half of the
 * component, lifted from `SidebarAppLauncher`'s roving-tabindex semantics
 * and generalized from a fixed 3-column layout to a tree that grows as
 * deep as the data does.
 *
 * Semantics (identical to the launcher):
 * - **Focus previews**: focusing a navigable row materializes its children
 *   column (the row becomes `selectionPath[col]`).
 * - **Activate = the node's primary affordance**: navigable → descend,
 *   selectable leaf → commit. A node that is BOTH navigable and selectable
 *   descends on activate; the commit goes through Enter/Space or the row's
 *   check CTA — the launcher separation (row = preview, CTA = activate).
 * - **Keyboard**: ↑↓ wrap inside the column, → descend (if navigable),
 *   ← back to the parent row, Enter/Space = the selectable-commit,
 *   `commit` stays the only way out.
 */
export function usePropNavigation(opts: {
	/** Root nodes (column 0) — getter so callers can pass a `$derived`. */
	nodes: () => PropNavNode[];
	/** Whether a node may be committed. Default: leaf nodes only. */
	isSelectable?: (n: PropNavNode) => boolean;
	/** Incompatible marker — disabled nodes can't COMMIT but may still be
	 *  descended into (a container can hide compatible descendants). */
	isDisabled?: (n: PropNavNode) => boolean;
	/** Reveal toggle state — disabled leafs hidden unless ON; navigable
	 *  nodes always stay visible (their subtree may hold compat paths). */
	showDisabled: () => boolean;
	/** Commits the node's full path — the only way out of the panel. */
	onCommit: (path: string) => void;
}) {
	/** The row selected in each column whose children form the next one. */
	let selectionPath = $state<PropNavNode[]>([]);
	/** Roving tabindex per column — Tab re-enters on the last-focused row. */
	let colFocusIdx = $state<number[]>([0]);
	/** Panel element — row queries scope to `[data-propnv-col]` inside it. */
	let panelEl = $state<HTMLElement | null>(null);
	/** Horizontal scroll container — new columns land it on scrollWidth. */
	let scrollEl = $state<HTMLElement | null>(null);
	/** Header preview chain — hover overrides the selection chain. */
	let hoverPath = $state<PropNavNode[] | null>(null);

	const isNavigable = (n: PropNavNode) => !!n.children?.length;
	const selectable = (n: PropNavNode) => opts.isSelectable?.(n) ?? !isNavigable(n);
	const disabled = (n: PropNavNode) => opts.isDisabled?.(n) ?? false;

	const columns = $derived.by(() => {
		const cols: PropNavNode[][] = [opts.nodes()];
		for (const sel of selectionPath) {
			const kids = sel?.children;
			if (kids?.length) cols.push(kids);
			else break;
		}
		return cols;
	});

	/** Rows hidden by the reveal toggle — disabled leafs only; navigable
	 *  nodes always render (their column may carry the compat leaf). */
	function visibleRows(col: number): PropNavNode[] {
		const rows = columns[col] ?? [];
		if (opts.showDisabled()) return rows;
		return rows.filter((n) => !disabled(n) || isNavigable(n));
	}

	/** Header chain — hover preview wins, else the current selection. */
	const headerChain = $derived(hoverPath ?? selectionPath);
	const headerNode = $derived(headerChain[headerChain.length - 1]);

	function rowsOf(col: number): HTMLElement[] {
		if (!panelEl) return [];
		return [...panelEl.querySelectorAll<HTMLElement>(`[data-propnv-col='${col}'] [data-propnv-row]`)];
	}

	function focusRow(col: number, idx: number) {
		const rows = rowsOf(col);
		if (rows.length === 0) return;
		rows[Math.max(0, Math.min(idx, rows.length - 1))].focus();
	}

	function trackFocus(col: number, idx: number) {
		colFocusIdx[col] = idx;
	}

	/** Focus/click descend — the row's children column materializes. */
	function descend(node: PropNavNode, col: number, focusNext = false) {
		if (!isNavigable(node)) return;
		selectionPath[col] = node;
		selectionPath.length = col + 1;
		if (focusNext) void tick().then(() => focusRow(col + 1, 0));
	}

	/** Row's primary action — descend when navigable, commit when a
	 *  selectable leaf. (Enter/Space forces commit for navigable+selectable.) */
	function activate(node: PropNavNode, col: number) {
		if (isNavigable(node)) descend(node, col, true);
		else if (selectable(node) && !disabled(node)) opts.onCommit(node.value);
	}

	/** Explicit commit — the check CTA / Enter on a navigable+selectable
	 *  node. Honest guard: never commits a disabled node. */
	function commit(node: PropNavNode) {
		if (selectable(node) && !disabled(node)) opts.onCommit(node.value);
	}

	function handleRowKeydown(e: KeyboardEvent, node: PropNavNode, col: number, idx: number) {
		const rows = rowsOf(col);
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			const next = e.key === 'ArrowDown' ? idx + 1 : idx - 1;
			focusRow(col, (next + rows.length) % rows.length);
		} else if (e.key === 'ArrowRight' && isNavigable(node)) {
			e.preventDefault();
			descend(node, col, true);
		} else if (e.key === 'ArrowLeft' && col > 0) {
			e.preventDefault();
			focusRow(col - 1, colFocusIdx[col - 1] ?? 0);
		} else if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			commit(node);
		}
	}

	/** Fresh open — selection and focus reset to the root column, then the
	 *  current value's row gets focus so its preview composes correctly. */
	function reset(currentPath?: string) {
		selectionPath = [];
		colFocusIdx = [0];
		hoverPath = null;
		if (!currentPath) return;
		// Reopen the chain the committed path belongs to — every ancestor
		// stays expanded, the leaf row receives focus.
		const segments = currentPath.replace(/^\$\.?/, '').split('.').filter(Boolean);
		let level = opts.nodes();
		const chain: PropNavNode[] = [];
		for (const seg of segments) {
			const node = level.find((n) => n.label === seg || n.value.endsWith(`.${seg}`));
			if (!node) break;
			chain.push(node);
			level = node.children ?? [];
		}
		if (chain.length > 0) {
			selectionPath = chain.slice(0, -1);
			const leaf = chain[chain.length - 1];
			const col = selectionPath.length;
			void tick().then(() => {
				const idx = visibleRows(col).indexOf(leaf);
				focusRow(col, idx >= 0 ? idx : 0);
			});
		}
	}

	/** Column-count grows → the viewport scrolls so the newest column is
	 *  instantly in view (the "auto-position right" requirement). */
	let prevColCount = $state(1);
	$effect(() => {
		const count = columns.length;
		if (scrollEl && count > prevColCount) {
			scrollEl.scrollLeft = scrollEl.scrollWidth;
		}
		prevColCount = count;
	});

	return {
		get columns() { return columns; },
		get selectionPath() { return selectionPath; },
		get colFocusIdx() { return colFocusIdx; },
		get headerChain() { return headerChain; },
		get headerNode() { return headerNode; },
		get panelEl() { return panelEl; },
		get scrollEl() { return scrollEl; },
		set panelEl(el: HTMLElement | null) { panelEl = el; },
		set scrollEl(el: HTMLElement | null) { scrollEl = el; },
		setHover(chain: PropNavNode[] | null) { hoverPath = chain; },
		isNavigable,
		selectable,
		disabled,
		visibleRows,
		focusRow,
		trackFocus,
		descend,
		activate,
		commit,
		handleRowKeydown,
		reset,
	};
}
