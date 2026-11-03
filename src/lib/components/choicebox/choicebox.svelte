<script lang="ts">
	/**
	 * Choicebox — a single-choice card group (radiogroup semantics).
	 * Each `Item` is an airy bordered card carrying a title, a description
	 * and a radio indicator; the selected card gets the primary border +
	 * ring. Keyboard contract: Enter/Space select, arrows move AND select
	 * (standard radio-group behavior), roving tabindex keeps one tab stop.
	 */
	import { cn } from '../../utils/index.js';
	import { setChoiceboxContext } from './ctx.js';
	import type { Snippet } from 'svelte';

	let {
		value = $bindable(),
		class: className,
		children,
		name,
		onValueChange,
		'data-testid': dataTestId,
	}: {
		value?: string;
		class?: string;
		children: Snippet;
		name?: string;
		onValueChange?: (value: string) => void;
		'data-testid'?: string;
	} = $props();

	setChoiceboxContext({
		activeValue: () => value,
		setActive: (v) => {
			value = v;
			onValueChange?.(v);
		},
	});
</script>

<div
	class={cn('flex flex-col gap-3', className)}
	role="radiogroup"
	aria-label={name}
	data-testid={dataTestId}
>
	{@render children()}
	{#if name}
		<!-- // standards-exempt: native-control — the hidden input IS the form-integration contract -->
		<input type="hidden" {name} {value} />
	{/if}
</div>
