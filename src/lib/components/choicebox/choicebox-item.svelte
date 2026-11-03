<script lang="ts">
	/**
	 * Choicebox.Item — one selectable card inside `Choicebox.Root`.
	 * `role="radio"` with `aria-checked`; click and Enter/Space select,
	 * arrows move focus AND selection (native radio-group contract).
	 * Disabled items expose `aria-disabled` and never activate.
	 */
	import { cn } from '../../utils/index.js';
	import { getChoiceboxContext } from './ctx.js';
	import type { Snippet } from 'svelte';

	let {
		value,
		class: className,
		children,
		disabled = false,
		'data-testid': dataTestId,
	}: {
		value: string;
		class?: string;
		children: Snippet;
		disabled?: boolean;
		'data-testid'?: string;
	} = $props();

	const ctx = getChoiceboxContext();
	const isSelected = $derived(ctx.activeValue() === value);

	function handleClick() {
		if (!disabled) ctx.setActive(value);
	}

	/** Radio-group keyboard: arrows move focus AND select (native radio
	 *  semantics) — vertical layout means Up/Down travel the stack;
	 *  Left/Right alias them. Home/End jump to the ends. */
	function handleKeyDown(e: KeyboardEvent) {
		if (disabled) return;
		// A selected card may host interactive children (the mode's builder
		// form) — keystrokes inside them belong to the control, not the radio.
		const target = e.target as HTMLElement;
		if (target !== e.currentTarget && target.closest('input,select,textarea,button,[contenteditable]')) {
			return;
		}
		const group = (e.currentTarget as HTMLElement).closest('[role="radiogroup"]');
		const items = group
			? [...group.querySelectorAll<HTMLElement>('[role="radio"]')].filter(
					(el) => el.getAttribute('aria-disabled') !== 'true',
				)
			: [];
		const idx = items.indexOf(e.currentTarget as HTMLElement);
		const move = (next: number) => {
			const el = items[next];
			if (el) {
				e.preventDefault();
				el.focus();
				el.click();
			}
		};
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleClick();
		} else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
			move(idx + 1 >= items.length ? 0 : idx + 1);
		} else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
			move(idx - 1 < 0 ? items.length - 1 : idx - 1);
		} else if (e.key === 'Home') {
			move(0);
		} else if (e.key === 'End') {
			move(items.length - 1);
		}
	}
</script>

<!-- Roving tabindex: before any selection every enabled card is a tab
     stop (first Tab lands on card 1); once a value exists only the
     checked card keeps tabindex 0 — the arrow contract carries the rest. -->
<div
	role="radio"
	aria-checked={isSelected}
	aria-disabled={disabled || undefined}
	tabindex={disabled ? -1 : ctx.activeValue() === undefined || isSelected ? 0 : -1}
	onclick={handleClick}
	onkeydown={handleKeyDown}
	data-state={isSelected ? 'checked' : 'unchecked'}
	data-testid={dataTestId}
	class={cn(
		'group relative flex cursor-pointer items-start rounded-lg border p-4 shadow-sm outline-none transition-all',
		'border-input bg-card',
		'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
		'data-[state=checked]:border-primary-gradient data-[state=checked]:bg-background data-[state=checked]:shadow-selected-primary',
		'data-[state=unchecked]:hover:bg-accent/50 data-[state=unchecked]:hover:text-accent-foreground',
		disabled && 'cursor-not-allowed opacity-50',
		className,
	)}
>
	<div class="flex-1 space-y-1 pl-10">
		{@render children()}
	</div>
</div>
