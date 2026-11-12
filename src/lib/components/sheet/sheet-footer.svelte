<script lang="ts">
	import type { WithElementRef } from '../../vendor/bits-ui.js';
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "../../utils/index.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	class={cn("bg-muted/50 -mx-6 -mb-6 border-t p-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
	{...restProps}
>
	{@render children?.()}
</div>
