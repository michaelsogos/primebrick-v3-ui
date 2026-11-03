<script lang="ts">
	/**
	 * Choicebox.Indicator — the radio dot pinned to the card's right edge.
	 * The inner dot animates in when the owning item is checked.
	 */
	import { cn } from '../../utils/index.js';

	let { class: className }: { class?: string } = $props();
</script>

<div
	class={cn(
		'absolute left-4 top-4 shrink-0 items-center justify-center',
		className,
	)}
>
	<div
		class="h-4 w-4 rounded-full border border-primary text-primary shadow-sm flex items-center justify-center ring-offset-background"
	>
		<div
			class="h-2 w-2 rounded-full bg-primary opacity-0 scale-0 transition-all duration-200 group-data-[state=checked]:opacity-100 group-data-[state=checked]:scale-100"
		></div>
	</div>
</div>
