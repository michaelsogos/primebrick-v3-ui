<script lang="ts">
	import { cn, type WithElementRef, type WithoutChildren } from "../../utils/index.js";
	import type { HTMLTextareaAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: className,
		"data-slot": dataSlot = "textarea",
		...restProps
	}: WithoutChildren<WithElementRef<HTMLTextareaAttributes>> = $props();
</script>

<textarea
	bind:this={ref}
	data-slot={dataSlot}
	class={cn(
		"focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive-gradient dark:aria-invalid:border-destructive-gradient rounded-lg border-primary-gradient bg-transparent px-2.5 py-2 text-base transition-all focus-visible:ring-3 aria-invalid:ring-3 md:text-sm placeholder:text-muted-foreground flex field-sizing-content min-h-16 w-full outline-none disabled:cursor-not-allowed disabled:border-disabled disabled:hover:brightness-100 readonly:border-readonly hover:brightness-105",
		className
	)}
	bind:value
	{...restProps}
></textarea>
