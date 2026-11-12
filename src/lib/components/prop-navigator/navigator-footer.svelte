<script lang="ts">
	import { cn } from '../../utils/index.js';
	import { inputTrailingIconColorClasses } from '../input/input-chrome.js';
	import { KeyboardHints } from '../keyboard-hints/index.js';
	import { EyeDashed } from '../../vendor/lucide.js';
	import { getT } from '../../bridges.js';

	const t = getT();

	let {
		showDisabled = $bindable(false),
		showReveal = false,
		'data-testid': dataTestId,
	}: {
		showDisabled?: boolean;
		/** Renders the eye-dashed partition toggle (a disabled predicate exists). */
		showReveal?: boolean;
		'data-testid'?: string;
	} = $props();
</script>

<KeyboardHints
	class="border-t border-border bg-muted/50 px-3 py-1.5"
	data-propnv-footer
	hints={[
		{ keys: ['↑', '↓', '←', '→'] },
		{ keys: ['⏎'], label: $t('app.common.select_value') },
		{ keys: ['esc'], size: 'modifier', label: $t('app.common.close') },
	]}
>
	{#snippet end()}
		{#if showReveal}
			<!-- Partition toggle — `eye-dashed`: reveals the disabled partition
			     (hidden data, NOT secrets). Same affordance as ComboSelect. -->
			<button
				type="button"
				onclick={(e) => {
					e.stopPropagation();
					showDisabled = !showDisabled;
				}}
				class={cn(inputTrailingIconColorClasses, showDisabled && 'text-foreground')}
				aria-label={$t(showDisabled ? 'app.common.hide_disabled_options' : 'app.common.show_disabled_options')}
				title={$t(showDisabled ? 'app.common.hide_disabled_options' : 'app.common.show_disabled_options')}
				aria-pressed={showDisabled}
				data-testid={dataTestId ? `${dataTestId}-toggle-disabled` : undefined}
			>
				<EyeDashed />
			</button>
		{/if}
	{/snippet}
</KeyboardHints>
