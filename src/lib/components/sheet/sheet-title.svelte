<script lang="ts">
	import { Dialog as SheetPrimitive } from '../../vendor/bits-ui.js';
	import { cn } from "../../utils/index.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: SheetPrimitive.TitleProps = $props();
</script>

<SheetPrimitive.Title
	bind:ref
	class={cn("text-foreground text-lg font-semibold", className)}
	{...restProps}
/>
