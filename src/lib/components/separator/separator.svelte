<script lang="ts">
	import { Separator as SeparatorPrimitive } from '../../vendor/bits-ui.js';
	import { cn } from "../../utils/index.js";

	let {
		ref = $bindable(null),
		class: className,
		orientation = "horizontal",
		...restProps
	}: SeparatorPrimitive.RootProps = $props();
</script>

<SeparatorPrimitive.Root
	bind:ref
	class={cn(
		"bg-border shrink-0",
		orientation === "horizontal" ? "h-px w-full" : "min-h-full w-px",
		className
	)}
	{orientation}
	{...restProps}
/>
