<script lang="ts">
	import { Command as CommandPrimitive } from '../../vendor/bits-ui.js';
	import { cn } from "../../utils/index.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: CommandPrimitive.SeparatorProps = $props();
</script>

<CommandPrimitive.Separator
	bind:ref
	data-slot="command-separator"
	class={cn("bg-border -mx-1 h-px", className)}
	{...restProps}
/>
