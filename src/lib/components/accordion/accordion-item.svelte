<script lang="ts">
	import { Accordion as AccordionPrimitive } from '../../vendor/bits-ui.js';
	import { cn } from "../../utils/index.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: AccordionPrimitive.ItemProps = $props();
</script>

<AccordionPrimitive.Item
	bind:ref
	data-slot="accordion-item"
	class={cn("not-last:border-b", className)}
	{...restProps}
/>
