<script lang="ts">
	import { Content as TooltipPrimitiveContent } from "../../vendor/bits-ui-tooltip.js";
	import type { ContentProps } from "../../vendor/bits-ui-tooltip.js";
	import type { Snippet } from "svelte";
	import { cn } from "../../utils/index.js";
	import TooltipPortal from "./tooltip-portal.svelte";
	import { Info } from '../../vendor/lucide.js';
	import { BadgeAlert } from '../../vendor/lucide.js';
	import { BadgeX } from '../../vendor/lucide.js';
	import { BadgeQuestionMark } from '../../vendor/lucide.js';
	import { Lightbulb } from '../../vendor/lucide.js';
	import { BadgeCheck } from '../../vendor/lucide.js';

	// Canonical union lives in @primebrick/core — re-exported for consumers by ./index.ts.
	import type { TooltipPriority } from '@primebrick/core';

	type Props = ContentProps & {
		priority?: TooltipPriority;
		title?: string;
		children: Snippet;
	};

	let {
		ref = $bindable(null),
		class: className,
		sideOffset = 4,
		priority = "INFORMATION",
		title,
		children,
		...restProps
	}: Props = $props();

	const iconMap = {
		INFORMATION: Info,
		WARNING: BadgeAlert,
		ERROR: BadgeX,
		QUESTION: BadgeQuestionMark,
		HINT: Lightbulb,
		SUCCESS: BadgeCheck,
	};
	// Project semaphoric colors — defined in src/app.css @theme block (text-info, text-warning, text-success, text-destructive)
	const colorMap = {
		INFORMATION: "text-info",
		WARNING: "text-warning",
		ERROR: "text-destructive",
		QUESTION: "text-info",
		HINT: "text-info",
		SUCCESS: "text-success",
	};

	const Icon = $derived(iconMap[priority]);
	const colorClass = $derived(colorMap[priority]);
</script>

<TooltipPortal>
	<TooltipPrimitiveContent
		bind:ref
		{sideOffset}
		class={cn(
			"bg-foreground text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-[100] overflow-hidden rounded-md border border-border/60 px-3 py-2 text-xs font-medium shadow-md max-w-xs",
			className
		)}
		{...restProps}
	>
		<div class="flex flex-col gap-1">
			{#if title}
				<div class="flex items-center gap-1.5 font-semibold {colorClass}">
					<Icon class="size-3.5 shrink-0" />
					{title}
				</div>
			{:else}
				<Icon class="size-3.5 shrink-0 {colorClass}" />
			{/if}
			<div class="text-background leading-relaxed">
				{@render children()}
			</div>
		</div>
	</TooltipPrimitiveContent>
</TooltipPortal>