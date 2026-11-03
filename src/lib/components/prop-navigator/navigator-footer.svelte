<script lang="ts">
	import { cn } from '../../utils/index.js';
	import { inputTrailingIconColorClasses } from '../input/input-chrome.js';
	import { Kbd } from '../kbd/index.js';
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

<div
	class="flex items-center gap-3 border-t border-border bg-muted/50 px-3 py-1.5 text-[11px] text-muted-foreground"
	data-propnv-footer
>
	<!-- Same hint anatomy as SidebarAppLauncher's footer — one cap per key,
	     verb label next to the action keys. -->
	<span class="inline-flex items-center gap-1">
		<Kbd size="key">↑</Kbd><Kbd size="key">↓</Kbd><Kbd size="key">←</Kbd><Kbd size="key">→</Kbd>
	</span>
	<span class="inline-flex items-center gap-1">
		<Kbd size="key">⏎</Kbd>
		<span>{$t('app.common.selectValue')}</span>
	</span>
	<span class="inline-flex items-center gap-1">
		<Kbd size="modifier">esc</Kbd>
		<span>{$t('app.common.close')}</span>
	</span>
	{#if showReveal}
		<!-- Partition toggle — `eye-dashed`: reveals the disabled partition
		     (hidden data, NOT secrets). Same affordance as ComboSelect. -->
		<button
			type="button"
			onclick={(e) => {
				e.stopPropagation();
				showDisabled = !showDisabled;
			}}
			class={cn('ms-auto', inputTrailingIconColorClasses, showDisabled && 'text-foreground')}
			aria-label={$t(showDisabled ? 'app.common.hideDisabledOptions' : 'app.common.showDisabledOptions')}
			title={$t(showDisabled ? 'app.common.hideDisabledOptions' : 'app.common.showDisabledOptions')}
			aria-pressed={showDisabled}
			data-testid={dataTestId ? `${dataTestId}-toggle-disabled` : undefined}
		>
			<EyeDashed />
		</button>
	{/if}
</div>
