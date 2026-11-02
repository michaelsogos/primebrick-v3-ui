<script lang="ts">
	import { Command as CommandPrimitive } from '../../vendor/bits-ui.js';
	import { cn } from "../../utils/index.js";
	import { Search as SearchIcon } from '../../vendor/lucide.js';
	import { Eraser } from '../../vendor/lucide.js';
	import { inputTrailingIconButtonClasses } from "../input/input-chrome.js";

	let {
		ref = $bindable(null),
		class: className,
		value = $bindable(""),
		...restProps
	}: Omit<CommandPrimitive.InputProps, 'ref'> & { ref?: HTMLInputElement | null } = $props();
</script>

<!-- Wrapper: p-1 + pb-2 for gap between search input and first dropdown item -->
<div data-slot="command-input-wrapper" class="p-1 pb-2">
	<!-- relative wrapper: carries the primary gradient border + hover, mirrors
	     the standard Input chrome (border-primary-gradient, shadow-xs, hover:brightness-105).
	     DRY: same border/hover pattern as input.svelte and CommandPalette.svelte.
	     No focus ring — the gradient border is the only visual indicator. -->
	<div
		class={cn(
			"relative flex h-8 w-full items-center rounded-md border-primary-gradient bg-input/30 shadow-xs transition-all hover:brightness-105",
			"focus-within:outline-none focus-within:ring-0 focus-within:ring-offset-0 focus-within:shadow-none",
		)}
	>
		<!-- Search icon on the left (inline-start) -->
		<SearchIcon class="pointer-events-none absolute left-2 top-1/2 z-1 size-4 -translate-y-1/2 shrink-0 opacity-50" />
		<!-- Command.Input: borderless, transparent — the wrapper carries the chrome.
		     bits-ui requires Command.Input for keyboard nav + filtering to work. -->
		<CommandPrimitive.Input
			{value}
			data-slot="command-input"
			class={cn(
				"h-full min-h-0 w-full border-0 bg-transparent pl-8 text-sm font-medium text-foreground outline-none",
				"placeholder:text-muted-foreground",
				"selection:bg-primary selection:text-primary-foreground",
				"focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
				"pr-8",
				className
			)}
			{...restProps}
		>
			{#snippet child({ props })}
				<input {...props} bind:value bind:this={ref} />
			{/snippet}
		</CommandPrimitive.Input>
		<!-- X clear button: absolute-positioned on the right, same pattern as
		     TextInput's clear button (inputTrailingIconButtonClasses). DRY.
		     Always rendered — disabled while the query is empty so the CTA
		     never pops the row's layout in and out. -->
		<button
			type="button"
			onclick={() => { value = ''; ref?.focus(); }}
			class={inputTrailingIconButtonClasses}
			aria-label="Clear search"
			disabled={!value}
			data-testid="command-input-clear"
		>
			<Eraser class="size-4" />
		</button>
	</div>
</div>
