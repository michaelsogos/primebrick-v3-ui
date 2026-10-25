<script lang="ts">
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
	const BAR_W = $derived(
		buckets && buckets.length > 0
			? Math.max(2, Math.floor((W - PAD * (buckets.length + 1)) / buckets.length))
			: 3
	);
	const maxTotal = $derived(
		buckets
			? Math.max(1, ...buckets.map((b) => series.reduce((sum, s) => sum + num(b[s.field]), 0)))
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
</script>

{#if buckets && buckets.length > 0}
	<svg viewBox="0 0 {W} {H}" class="block h-7 w-[120px]" role="img" aria-label="sparkline">
		{#each buckets as b, i}
			{@const x = barX(i)}
			{#each series as s, si}
				{@const segH = h(num(b[s.field]))}
				{#if segH > 0}
					<rect x={x} y={segmentY(b, si)} width={BAR_W} height={segH} class={s.color} rx="0.5">
						<title>{bucketLabel(b)}: {num(b[s.field])} {s.label ?? s.field}</title>
					</rect>
				{/if}
			{/each}
		{/each}
	</svg>
{:else}
	<span class="text-muted-foreground text-xs">—</span>
{/if}
