<script lang="ts" module>
	export { kbdVariants } from './kbd-variants.js';
	export type { KbdSize, KbdTone } from './kbd-variants.js';
</script>

<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { kbdVariants, type KbdSize, type KbdTone } from './kbd-variants.js';
	import { cn, type WithElementRef } from "../../utils/index.js";

	type Props = WithElementRef<HTMLAttributes<HTMLElement>, HTMLElement> & {
		size?: KbdSize;
		tone?: KbdTone;
		children?: import("svelte").Snippet;
	};

	let { ref = $bindable(null), class: className, size = "key", tone = "default", children, ...restProps }: Props = $props();
</script>

<kbd bind:this={ref} data-slot="kbd" class={cn(kbdVariants({ size, tone }), className)} {...restProps}>
	{@render children?.()}
</kbd>
