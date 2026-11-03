<script lang="ts" module>
	import { tv, type VariantProps } from '@primebrick/ui/vendor/tailwind-variants';

	export const tabsListVariants = tv({
		base: "rounded-lg p-[3px] group-data-horizontal/tabs:h-8 data-[variant=line]:rounded-none group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
		variants: {
			variant: {
				default: "cn-tabs-list-variant-default relative bg-muted",
				line: "cn-tabs-list-variant-line gap-1 bg-transparent",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	});

	export type TabsListVariant = VariantProps<typeof tabsListVariants>["variant"];
</script>

<script lang="ts">
	import { setContext } from 'svelte';
	import { Tabs as TabsPrimitive } from '@primebrick/ui/vendor/bits-ui';
	import { cn } from "../../utils/index.js";
	import type { TabsListContext } from './tabs-ctx.js';

	// must match the key in tabs-ctx.ts — kept literal so sveld can resolve the
	// setContext call for context-docs extraction.
	const TABS_LIST_CTX = 'primebrick-tabs-list';

	let {
		ref = $bindable(null),
		variant = "default",
		class: className,
		children,
		...restProps
	}: TabsPrimitive.ListProps & {
		variant?: TabsListVariant;
	} = $props();

	/**
	 * Single sliding pill (default variant): one element that translates to the
	 * active trigger's geometry. Trigger labels never move — their color
	 * follows the pill via the settled-value context, so a label turns active
	 * only when the pill lands on it (never mid-flight).
	 */
	let pill = $state<{ x: number; y: number; w: number; h: number } | null>(null);
	let settledValue = $state<string | null>(null);
	let arrivingValue: string | null = null;
	let settleTimer: ReturnType<typeof setTimeout> | undefined;
	const reducedMotion =
		typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	setContext<TabsListContext>(TABS_LIST_CTX, {
		get settledValue() {
			return settledValue;
		},
	});

	function activeTrigger(): HTMLElement | null {
		return (ref as HTMLElement | null)?.querySelector<HTMLElement>('[data-state="active"]') ?? null;
	}

	function measure() {
		const active = activeTrigger();
		pill = active
			? { x: active.offsetLeft, y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight }
			: null;
	}

	function settle() {
		settledValue = arrivingValue;
		clearTimeout(settleTimer);
	}

	function onActiveChange() {
		arrivingValue = activeTrigger()?.dataset.value ?? null;
		// line variant has no pill to wait for — settle immediately
		if (variant === 'line' || reducedMotion) settle();
		else {
			clearTimeout(settleTimer);
			// safety: transitionend may not fire (display:none, interrupted anims)
			settleTimer = setTimeout(settle, 300);
		}
		measure();
	}

	$effect(() => {
		const el = ref as HTMLElement | null;
		if (!el) return;
		settledValue = arrivingValue = activeTrigger()?.dataset.value ?? null;
		measure();
		const mo = new MutationObserver(onActiveChange);
		mo.observe(el, { attributes: true, subtree: true, attributeFilter: ['data-state'] });
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => {
			mo.disconnect();
			ro.disconnect();
			clearTimeout(settleTimer);
		};
	});
</script>

<TabsPrimitive.List
	bind:ref
	data-slot="tabs-list"
	data-variant={variant}
	class={cn(tabsListVariants({ variant }), className)}
	{...restProps}
>
	{#if variant === 'default' && pill}
		<div
			aria-hidden="true"
			data-slot="tabs-pill"
			class="border-primary-gradient bg-background shadow-selected-primary pointer-events-none absolute top-0 left-0 z-0 rounded-md transition-[transform,width,height] duration-200 ease-out"
			style="transform: translate({pill.x}px, {pill.y}px); width: {pill.w}px; height: {pill.h}px;"
			ontransitionend={(e) => {
				if (e.propertyName === 'transform') settle();
			}}
		></div>
	{/if}
	{@render children?.()}
</TabsPrimitive.List>
