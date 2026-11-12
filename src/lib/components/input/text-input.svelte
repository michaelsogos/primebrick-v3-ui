<script lang="ts">
	/**
	 * TextInput — canonical single-line text input.
	 *
	 * Trailing contract (multi-CTA): the built-in clear button (`Eraser`,
	 * `clearable` default true) is ALWAYS rendered in editable mode — never
	 * hidden (a disappearing CTA shifts the row's layout); it renders
	 * `disabled` while the value is empty. It always owns the right edge
	 * (`right-1.5` = rightmost, glyph 12px
	 * from border). Readonly/disabled mode renders
	 * no clear — the copy button takes the same right edge instead.
	 *
	 * Extra CTAs: prefer `trailing_ctas` — the component OWNS the geometry.
	 * Multi-CTA uses the DS's one existing standard, ComboSelect's trailing
	 * zone: a single flex row `gap-1` (4px) of `inputTrailingIconColorClasses`
	 * buttons, clear rightmost — identical anatomy, identical 4px spacing.
	 * Single-CTA keeps the canonical lone treatment (size-7, right-1.5).
	 * The `trailing` snippet remains for non-CTA content that must
	 * self-position.
	 */
	import type { HTMLInputAttributes, HTMLInputTypeAttribute } from "svelte/elements";
	import type { Snippet } from "svelte";
	import { cn, type WithElementRef } from "../../utils/index.js";
	import Input from "./input.svelte";
	import { CopyButton } from "../copy-button/index.js";
	import * as Tooltip from "../tooltip/index.js";
	import { Eraser } from '@primebrick/ui/vendor/lucide';
	import { inputTrailingIconButtonClasses, inputTrailingIconColorClasses } from './input-chrome.js';
	import DynamicIcon from '../dynamic-icon/DynamicIcon.svelte';

	type InputType = Exclude<HTMLInputTypeAttribute, "file">;

	type Props = WithElementRef<
		Omit<HTMLInputAttributes, "type" | "files"> & {
			type?: InputType;
			value?: string;
			// --- Clear button (editable mode) ---
			clearable?: boolean;
			onClear?: () => void;
			clearLabel?: string;
			// --- Copy button (readonly/disabled mode) ---
			onCopy?: (status: "success" | "failure" | undefined) => void;
			copyTooltipLabel?: string;
			copyAnimationDuration?: number;
			// --- Extra trailing content (e.g. async status icon) ---
			trailing?: Snippet;
			// --- Extra trailing CTAs — component-owned slots (preferred) ---
			trailing_ctas?: TrailingCta[];
		}
	>;

/** A trailing icon CTA — rendered inside the shared `gap-1` trailing row;
 *  array order is left→right, the clear button always stays rightmost. */
export type TrailingCta = {
	/** Lucide icon name (resolved via DynamicIcon — composed names work). */
	icon: string;
	/** aria-label + tooltip text. */
	label: string;
	onclick: () => void;
	disabled?: boolean;
	"data-testid"?: string;
};

	let {
		ref = $bindable(null),
		value = $bindable(""),
		type,
		readonly = false,
		disabled = false,
		clearable = true,
		onClear,
		clearLabel = "Clear",
		onCopy,
		copyTooltipLabel,
		copyAnimationDuration = 2000,
		trailing,
		trailing_ctas,
		class: className,
		...restProps
	}: Props = $props();

	let mode = $derived(disabled ? "disabled" : readonly ? "readonly" : "editable");

	// Clear CTA: always rendered in editable+clearable mode — a CTA that
	// appears/disappears with content shifts the input layout; it is
	// `disabled` while there is nothing to clear.
	let showClear = $derived(mode === "editable" && clearable);
	let clearDisabled = $derived((value ?? "").length === 0);
	let showCopy = $derived(mode !== "editable" && (value ?? "").length > 0);
	let showTrailing = $derived(showClear || showCopy);

	// Multi-CTA geometry — the DS's ONE existing standard is ComboSelect's
	// trailing zone: a flex row `gap-1` (4px) of `inputTrailingIconColorClasses`
	// elements (p-0.5 → 20px boxes). When trailing_ctas are present ALL
	// trailing buttons (clear included) render in that same anatomy so the
	// inter-CTA spacing can never diverge. Single-CTA keeps the canonical
	// lone-CTA treatment (size-7, right-1.5).
	let ctaCount = $derived(trailing_ctas?.length ?? 0);
	let multiCta = $derived(ctaCount > 0);

	let inputClass = $derived(
		cn(
			showTrailing && !multiCta && "pr-9",
			mode === "readonly" && "border-readonly",
			className,
		),
	);
	let inputStyle = $derived(
		showTrailing && multiCta
			? `padding-right:${6 + (ctaCount + 1) * 20 + ctaCount * 4 + 6}px`
			: undefined,
	);

	function handleClear() {
		value = "";
		onClear?.();
		ref?.focus();
	}
</script>

<div class="relative">
	<Input
		bind:ref
		bind:value
		{type}
		{readonly}
		{disabled}
		class={inputClass}
		style={inputStyle}
		{...restProps}
	/>

	{#if showCopy}
			{#if copyTooltipLabel}
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props: tooltipProps })}
							<CopyButton
								text={value ?? ""}
								variant="ghost"
								size="icon"
								animationDuration={copyAnimationDuration}
								onCopy={onCopy}
								class={inputTrailingIconButtonClasses}
								{...tooltipProps}
							/>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content>{copyTooltipLabel}</Tooltip.Content>
				</Tooltip.Root>
			{:else}
				<CopyButton
					text={value ?? ""}
					variant="ghost"
					size="icon"
					animationDuration={copyAnimationDuration}
					onCopy={onCopy}
					class={inputTrailingIconButtonClasses}
				/>
			{/if}
	{/if}

	{#if trailing}
		{@render trailing()}
	{/if}

	{#if multiCta}
		<div class="absolute top-1/2 right-1.5 z-10 flex -translate-y-1/2 items-center gap-1">
			{#each trailing_ctas ?? [] as cta (cta.label)}
				<button
					type="button"
					tabindex={-1}
					aria-label={cta.label}
					title={cta.label}
					disabled={cta.disabled}
					data-testid={cta["data-testid"]}
					onclick={cta.onclick}
					class={inputTrailingIconColorClasses}
				>
					<DynamicIcon name={cta.icon} size={16} />
				</button>
			{/each}
			{#if showClear}
				<button
					type="button"
					onclick={handleClear}
					aria-label={clearLabel}
					title={clearLabel}
					tabindex={-1}
					disabled={clearDisabled}
					class={inputTrailingIconColorClasses}
				>
					<Eraser class="size-4" />
				</button>
			{/if}
		</div>
	{:else if showClear}
		<button
			type="button"
			onclick={handleClear}
			aria-label={clearLabel}
			title={clearLabel}
			tabindex={-1}
			disabled={clearDisabled}
			class={inputTrailingIconButtonClasses}
		>
			<Eraser class="size-4" />
		</button>
	{/if}
</div>
