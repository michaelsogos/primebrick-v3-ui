<script lang="ts" module>
	/** Right-most TEXT button of the search field (e.g. the ELT search-scope selector). */
	export type SearchTrailingButton = {
		/** Visible button text (already translated by the caller). */
		label: string;
		onclick: () => void;
		/** aria-label override — defaults to `label`. */
		aria_label?: string;
		"data-testid"?: string;
	};
</script>

<script lang="ts">
	/**
	 * SearchInput — the canonical search field anatomy:
	 *
	 *   [Search icon] [input | syntax-highlighted input] [icon CTAs…] [eraser] [text button]
	 *
	 * One contract for every search surface — list toolbars (ELT), custom
	 * list/form toolbars, selection panels, dropdown-internal search rows —
	 * so no consumer rebuilds the icon+input+clear+scope anatomy ad hoc.
	 *
	 * - `highlight` opts into the escape-syntax overlay input (`\*` `\?`
	 *   sequences are tinted by SearchSyntaxHighlighter).
	 * - `trailing_ctas` renders icon CTAs to the LEFT of the clear CTA
	 *   (same contract as TextInput's `trailing_ctas`).
	 * - `trailing_button` is the right-most TEXT CTA (e.g. search scope).
	 * - `variant='borderless'` strips the group chrome for rows embedded
	 *   inside popover/dropdown chrome.
	 */
	import {
		InputGroup,
		InputGroupAddon,
		InputGroupButton,
		InputGroupInput,
		HighlightedInput,
	} from '../input-group/index.js';
	import { Search, Eraser } from '@primebrick/ui/vendor/lucide';
	import DynamicIcon from '../dynamic-icon/DynamicIcon.svelte';
	import { getT } from '../../bridges.js';
	import { cn } from '../../utils/index.js';
	import type { TrailingCta } from '../input/text-input.svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		value = $bindable(''),
		placeholder,
		highlight = false,
		clearable = true,
		trailing_ctas,
		trailing_button,
		on_clear,
		variant = 'field',
		class: className,
		input_class,
		disabled,
		id,
		name,
		oninput,
		onkeydown,
		data_testid,
	}: {
		/** Bindable query string. */
		value?: string;
		placeholder?: string;
		/** Opt-in escape-syntax highlighting underlay (`\*`, `\?`). */
		highlight?: boolean;
		/** Show the eraser CTA while the query is non-empty. Default true. */
		clearable?: boolean;
		/** Icon CTAs rendered to the LEFT of the eraser — same shape as TextInput's. */
		trailing_ctas?: TrailingCta[];
		/** Right-most text CTA (e.g. the search-scope selector). */
		trailing_button?: SearchTrailingButton;
		/** Fired when the eraser clears the field — required in controlled mode
		 *  (`value=` without bind) so the parent can empty its own state. */
		on_clear?: () => void;
		/** 'field' = bordered group chrome (toolbars); 'borderless' for popover-embedded rows. */
		variant?: 'field' | 'borderless';
		class?: string;
		/** Extra classes on the inner input element. */
		input_class?: string;
		disabled?: boolean;
		id?: string;
		name?: string;
		oninput?: HTMLInputAttributes['oninput'];
		onkeydown?: HTMLInputAttributes['onkeydown'];
		data_testid?: string;
	} = $props();

	const t = getT();

	let hasText = $derived(value.trim().length > 0);

	function clear() {
		value = '';
		on_clear?.();
	}
</script>

<InputGroup
	class={cn(
		variant === 'field' &&
			'group/input w-full border-foreground/25 hover:border-foreground/40 focus-within:border-foreground/50 focus-within:ring-2 focus-within:ring-foreground/20 rounded-md transition-all duration-200',
		variant === 'borderless' && 'border-none',
		className
	)}
	data-testid={data_testid}
>
	<InputGroupAddon align="inline-start" class="bg-transparent border-none pr-0">
		<Search
			class="size-4 text-muted-foreground transition-colors {variant === 'field'
				? 'group-hover/input:text-foreground'
				: ''}"
		/>
	</InputGroupAddon>

	{#if highlight}
		<HighlightedInput
			class={cn('text-sm placeholder:text-muted-foreground/70', input_class)}
			bind:value
			{placeholder}
			{oninput}
			{onkeydown}
			{disabled}
			{id}
			{name}
		/>
	{:else}
		<InputGroupInput
			class={cn('text-sm placeholder:text-muted-foreground/70', input_class)}
			bind:value
			{placeholder}
			{oninput}
			{onkeydown}
			{disabled}
			{id}
			{name}
		/>
	{/if}

	{#each trailing_ctas ?? [] as cta (cta.label)}
		<InputGroupButton
			variant="ghost"
			size="icon-xs"
			onclick={cta.onclick}
			aria-label={cta.label}
			title={cta.label}
			disabled={cta.disabled}
			data-testid={cta['data-testid']}
		>
			<DynamicIcon name={cta.icon} size={16} />
		</InputGroupButton>
	{/each}

	{#if clearable && hasText}
		<InputGroupButton
			variant="ghost"
			size="icon-xs"
			class="mr-1 hover:bg-sky-100/50 dark:hover:bg-white/10"
			onclick={clear}
			aria-label={$t('app.common.reset')}
			title={$t('app.common.reset')}
			data-testid={data_testid ? `${data_testid}-clear` : undefined}
		>
			<Eraser class="size-4" />
		</InputGroupButton>
	{/if}

	{#if trailing_button}
		<InputGroupButton
			variant="ghost"
			size="xs"
			class="h-full rounded-l-none rounded-r-md border-l border-foreground/25 bg-foreground/5 transition-colors"
			onclick={trailing_button.onclick}
			aria-label={trailing_button.aria_label ?? trailing_button.label}
			data-testid={trailing_button['data-testid']}
		>
			{trailing_button.label}
		</InputGroupButton>
	{/if}
</InputGroup>
