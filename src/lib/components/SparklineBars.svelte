<script lang="ts">
	// Namespace import — the canonical shape (barrel: `export * as Tooltip`).
	// `import { Tooltip }` would bind the Root-alias component, and
	// `<Tooltip.Root>` would silently resolve undefined.
	import * as Tooltip from './tooltip/index.js';

	/**
	 * SparklineBars — per-row stacked mini-histogram for `type:"sparkline"`
	 * meta columns (Kestra-style execution buckets).
	 *
	 * Renders one stacked SVG bar per bucket: series stack bottom→top in the
	 * declared order; the Y axis auto-scales to the max bucket total; bucket
	 * labels come from `bucket_unit` (hour|day|week|month).
	 *
	 * Fed from the list engine's `sparklineData` map (one batch POST per rows
	 * load declared by `column.sparkline` — no per-page wiring). Pure SVG +
	 * plain props, so the same component compiles safely inside host and
	 * remote module bundles.
	 *
	 * Tooltips are the canonical bits-ui standard — a transparent DOM
	 * trigger overlays each slot (the painted segment can be ~1px tall, an
	 * impossible hit target); the styled Content escapes the cell's
	 * overflow via the portal.
	 */

	export type SparklineBucket = {
		bucket_start: string;
		[field: string]: string | number;
	};

	export type SparklineSeries = {
		/** Bucket field supplying the segment value. */
		field: string;
		/** Tailwind `fill-*` utility class (e.g. `fill-emerald-500`). */
		color: string;
		/** Already-resolved label for the segment tooltip. */
		label?: string;
	};

	let {
		buckets,
		bucketUnit,
		series,
		bucketField = 'bucket_start'
	}: {
		buckets: SparklineBucket[] | undefined;
		bucketUnit?: string;
		series: SparklineSeries[];
		bucketField?: string;
	} = $props();

	const W = 120;
	const H = 28;
	const PAD = 1;
	/** Fixed slot count — the sample is always rendered as exactly MAX_BARS
	 *  slots (empty buckets render as a baseline tick), so bar width is
	 *  constant at any viewport and the cell never scales unboundedly. */
	const MAX_BARS = 10;
	const BAR_W = Math.floor((W - PAD * (MAX_BARS + 1)) / MAX_BARS);
	/** Right-aligned tail: the LAST slot is the current bucket — the most
	 *  recent MAX_BARS buckets are shown, position = time. */
	const shown = $derived(buckets ? buckets.slice(-MAX_BARS) : undefined);
	const offset = $derived(shown ? MAX_BARS - shown.length : 0);
	const maxTotal = $derived(
		shown && shown.length > 0
			? Math.max(1, ...shown.map((b) => series.reduce((sum, s) => sum + num(b[s.field]), 0)))
			: 1
	);

	function num(v: unknown): number {
		const n = Number(v ?? 0);
		return Number.isFinite(n) ? n : 0;
	}
	function barX(i: number): number {
		return PAD + i * (BAR_W + PAD);
	}
	function h(v: number): number {
		return Math.round((v / maxTotal) * (H - 4));
	}
	function bucketLabel(b: SparklineBucket): string {
		const d = new Date(String(b[bucketField]));
		if (bucketUnit === 'hour') return d.toISOString().slice(5, 13).replace('T', ' ');
		if (bucketUnit === 'month') return d.toISOString().slice(0, 7);
		return d.toISOString().slice(5, 10);
	}
	/** Stacked segment bottom offsets — series render bottom→top in array
	 *  order, so segment i sits on segments 0..i-1. */
	function segmentY(b: SparklineBucket, si: number): number {
		let below = 0;
		for (let j = 0; j < si; j++) below += h(num(b[series[j].field]));
		return H - below - h(num(b[series[si].field]));
	}
	/** Per-slot tooltip — every series quantified, zero counts included. */
	function bucketTitle(b: SparklineBucket): string {
		const parts = series.map((s) => `${num(b[s.field])} ${s.label ?? s.field}`);
		return `${bucketLabel(b)}: ${parts.join(', ')}`;
	}
</script>

<div class="relative inline-block">
	<svg viewBox="0 0 {W} {H}" class="block h-7 w-[120px]" role="img" aria-label="sparkline">
		{#each { length: MAX_BARS } as _, i (i)}
			{@const b = shown && i >= offset ? shown[i - offset] : undefined}
			{@const x = barX(i)}
			{#if b}
				{@const total = series.reduce((sum, s) => sum + num(b[s.field]), 0)}
				{#if total === 0}
					<rect {x} y={H - 2} width={BAR_W} height={1.5} class="fill-muted-foreground/30" rx="0.5" />
				{:else}
					{#each series as s, si (s.field)}
						{@const segH = h(num(b[s.field]))}
						{#if segH > 0}
							<rect x={x} y={segmentY(b, si)} width={BAR_W} height={segH} class={s.color} rx="0.5" />
						{/if}
					{/each}
				{/if}
			{/if}
		{/each}
	</svg>
	{#each { length: MAX_BARS } as _, i (i)}
		{@const b = shown && i >= offset ? shown[i - offset] : undefined}
		{#if b}
			<Tooltip.Root>
				<Tooltip.Trigger
					class="absolute top-0 h-full cursor-default"
					style="left: {(barX(i) / W) * 100}%; width: {(BAR_W / W) * 100}%"
					aria-label={bucketTitle(b)}
				/>
				<Tooltip.Content>{bucketTitle(b)}</Tooltip.Content>
			</Tooltip.Root>
		{/if}
	{/each}
</div>
