<script lang="ts">
	/**
	 * ScheduleSpecCell — the canonical `format:"schedule_spec"` LIST renderer.
	 * Raw spec in a badge + the localized human description below it
	 * (same prose the schedule-spec input shows — `scheduleDescriptionText`
	 * is the single formatter). Invalid specs degrade to the raw text —
	 * the writer already validated at save time; the cell never invents.
	 */
	import { getT, getLocale } from '../../bridges.js';
	import { Badge } from '../badge/index.js';
	import { describeScheduleSpec } from '../../utils/parse-schedule-spec.js';
	import { scheduleDescriptionText } from '../../utils/schedule-spec-i18n.js';
	import { cn } from '../../utils/index.js';

	const t = getT();
	const locale = getLocale();

	let {
		value,
		class: className,
	}: {
		/** The canonical spec string (`@every 15s`, cron expr, `@at …`). */
		value: string;
		class?: string;
	} = $props();

	const description = $derived(describeScheduleSpec(value, locale()));
	const descriptionText = $derived(
		description ? scheduleDescriptionText(description, $t, locale()) : undefined,
	);
</script>

{#if description}
	<div class={cn('flex min-w-0 flex-col gap-0.5', className)}>
		<span class="min-w-0 truncate text-xs">{descriptionText}</span>
		<Badge variant="outline" class="w-fit max-w-full truncate font-mono text-[11px] text-muted-foreground shadow-none">
			{value}
		</Badge>
	</div>
{:else}
	<span class={cn('min-w-0 truncate', className)}>{value}</span>
{/if}
