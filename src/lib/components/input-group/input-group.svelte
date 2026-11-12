<script lang="ts">
	import { cn, type WithElementRef } from "../../utils/index.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...props
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="input-group"
	role="group"
	class={cn(
		// Canonical field chrome — NEVER the vendored-kit color tokens (they
		// are the stock defaults, not the product vocabulary): neutral
		// `foreground/*` ghost chrome like the toolbar / inputGhostChromeClasses
		// contract. Field-gradient chrome (primary-gradient border + primary
		// ring) is the CONSUMER's own class — see numeric-input — not the
		// group's default.
		"group/input-group border-foreground/25 bg-transparent has-[[data-slot=input-group-control]:focus-visible]:border-foreground/50 has-[[data-slot=input-group-control]:focus-visible]:ring-foreground/20 has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[[data-slot][aria-invalid=true]]:border-destructive dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40 has-[[data-slot=input-group-control]:disabled]:bg-muted/50 h-9 rounded-md border transition-colors in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0 has-[[data-slot=input-group-control]:disabled]:opacity-50 has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot][aria-invalid=true]]:ring-3 has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5 relative flex w-full min-w-0 items-center outline-none has-[>textarea]:h-auto",
		className
	)}
	{...props}
>
	{@render children?.()}
</div>
