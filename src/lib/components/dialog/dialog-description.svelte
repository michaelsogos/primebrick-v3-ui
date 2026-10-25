<script lang="ts">
	import { Dialog as DialogPrimitive } from '../../vendor/bits-ui.js';
	import { cn } from "../../utils/index.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: DialogPrimitive.DescriptionProps = $props();
</script>

<DialogPrimitive.Description
	bind:ref
	data-slot="dialog-description"
	class={cn("text-muted-foreground *:[a]:hover:text-foreground text-sm *:[a]:underline *:[a]:underline-offset-3", className)}
	{...restProps}
/>
