<script lang="ts">
	/**
	 * CronInput — guided 5-field cron editor, OTP-flow edition.
	 *
	 * - ONE continuous mono bar, 5 equal cells (`MIN HRS DOM MTH DOW` UOM
	 *   abbreviations under the cells — literal, language-agnostic).
	 * - OTP-style auto-advance: a digit run reaching the field's max digit
	 *   count jumps to the next cell; continuation chars (`-` `,` `/`) typed
	 *   into an empty cell bounce back and extend the previous field — typing
	 *   flows across cells like one input.
	 * - Space / → / Tab / Enter advance to the next cell (Enter on the last
	 *   cell fires `onsubmit`); ← at the start goes back; ↑/↓ step a numeric
	 *   draft inside its range.
	 * - Field-aware keystroke mask: digits capped at maxDigits and ≤ max
	 *   (out-of-range untypeable); leading zeros allowed then normalized
	 *   live (`00`→`0`, `09`→`9`); `?`/`L`/`W`/`#` only in quartz fields;
	 *   name letters only as valid name prefixes — rejected chars flash.
	 * - Paste fan-out: a full expression pasted in any cell fills them all.
	 * - The human description is the hero — centered, italic, quoted, full
	 *   foreground (never muted), BELOW the active field's clickable
	 *   example chips (one per operator form); a flat key:value ops
	 *   legend. Next-run previews are the parent's concern (badges).
	 * - `valid` binds out for the host's submit gate.
	 */
	import { onMount } from 'svelte';
	import { cn } from '../../utils/index.js';
	import { Eraser, Info } from '../../vendor/lucide.js';
	import { inputTrailingIconButtonClasses } from '../input/input-chrome.js';
	import { getT, getLocale } from '../../bridges.js';
	import {
		parseScheduleSpec,
		describeScheduleSpec,
	} from '../../utils/parse-schedule-spec.js';
	import {
		CRON_FIELDS,
		CONTINUATION_CHARS,
		acceptChar,
		digitRunLength,
		distributePaste,
		emitExpression,
		normalizeToken,
		validateFieldToken,
		type CronFieldMeta,
	} from './cron-fields.js';

	let {
		value = $bindable(''),
		valid = $bindable(false),
		disabled = false,
		onsubmit,
		class: className,
		'data-testid': dataTestId,
	}: {
		value?: string;
		valid?: boolean;
		disabled?: boolean;
		onsubmit?: () => void;
		class?: string;
		'data-testid'?: string;
	} = $props();

	const t = getT();
	const locale = getLocale();

	const draftsFrom = (v: string): string[] => {
		const parts = v.trim() === '' ? [] : v.trim().split(/\s+/);
		return CRON_FIELDS.map((_, i) => parts[i] ?? '');
	};

	let drafts = $state<string[]>(draftsFrom(value));
	let inputEls = $state<(HTMLInputElement | null)[]>([]);
	let focusedIdx = $state(0);
	let showLegend = $state(false);
	let flashIdx = $state(-1);
	let flashTimer: ReturnType<typeof setTimeout> | undefined;

	onMount(() => inputEls[0]?.focus());

	// External `value` changes reseed the drafts. Our own emissions echo back
	// through bind:value — skip them (else `* * * * *` would turn empty cells
	// into literal `*` tokens). `''` and `* * * * *` are the same empty=*
	// state, so the draft-content guard prevents a reseed loop.
	$effect(() => {
		const incoming = value;
		if (incoming === emitExpression(drafts)) return;
		const next = draftsFrom(incoming);
		if (next.join(' ') !== drafts.join(' ')) drafts = next;
	});

	const fieldStates = $derived(
		CRON_FIELDS.map((meta, i) => {
			const token = drafts[i] ?? '';
			return {
				meta,
				token,
				state:
					token === ''
						? ('pending' as const)
						: validateFieldToken(meta, token)
							? ('ok' as const)
							: ('invalid' as const),
			};
		})
	);
	const hasInvalid = $derived(fieldStates.some((s) => s.state === 'invalid'));
	const firstInvalid = $derived(fieldStates.find((s) => s.state === 'invalid'));
	const activeMeta = $derived(CRON_FIELDS[focusedIdx]);
	// empty = `*` — the preview and the emitted value share the same
	// *-filled expression, so the user always sees the FINAL result.
	const expr = $derived(emitExpression(drafts));
	const exprOk = $derived(!hasInvalid && parseScheduleSpec(expr).ok);
	const description = $derived(exprOk ? describeScheduleSpec(expr, locale()) : undefined);

	$effect(() => {
		valid = exprOk;
	});

	function flash(i: number) {
		flashIdx = i;
		clearTimeout(flashTimer);
		flashTimer = setTimeout(() => (flashIdx = -1), 350);
	}

	function commit() {
		value = emitExpression(drafts);
	}

	function focusField(i: number) {
		if (i < 0 || i >= CRON_FIELDS.length) return;
		inputEls[i]?.focus();
		inputEls[i]?.select();
	}

	/** Rebuild the draft char-by-char through the field-aware mask. */
	function fieldInput(i: number, e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		const meta = CRON_FIELDS[i];

		// Bounce-back: a continuation char typed into an empty cell extends the
		// previous field instead — OTP-flow keeps ranges like `10-31` natural.
		if (drafts[i] === '' && el.value.length === 1 && CONTINUATION_CHARS.has(el.value)) {
			const ch = el.value;
			el.value = '';
			// Extend the nearest non-empty previous field — a leading `*`/name
			// field is skipped only if empty, never mutated wrongly.
			const target = drafts.slice(0, i).reduce((last, d, j) => (d !== '' ? j : last), -1);
			if (target >= 0) {
				drafts[target] = normalizeToken(drafts[target] + ch);
				commit();
				focusField(target);
			} else flash(i);
			return;
		}

		let acc = '';
		let rejected = false;
		for (const raw of el.value.toUpperCase()) {
			// `/` at a segment start implies the `*` wildcard (`/5` → `*/5`).
			if (raw === '/' && (acc === '' || acc.endsWith(','))) acc += '*';
			if (acceptChar(meta, acc, raw)) acc += raw;
			else rejected = true;
		}
		acc = normalizeToken(acc);
		if (rejected) flash(i);
		if (el.value !== acc) el.value = acc;
		drafts[i] = acc;
		commit();

		// OTP auto-advance: the digit run is full — nothing more can be typed
		// here except an operator (which bounces back anyway).
		if (digitRunLength(acc) === String(meta.max).length && i < CRON_FIELDS.length - 1) {
			focusField(i + 1);
		}
	}

	function fieldKeydown(i: number, e: KeyboardEvent) {
		const el = e.currentTarget as HTMLInputElement;
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			if (i < CRON_FIELDS.length - 1) focusField(i + 1);
			else onsubmit?.();
		} else if (e.key === 'ArrowRight' && (el.selectionStart ?? 0) >= el.value.length) {
			e.preventDefault();
			focusField(i + 1);
		} else if (e.key === 'ArrowLeft' && (el.selectionStart ?? 0) <= 0) {
			e.preventDefault();
			focusField(i - 1);
		} else if (
			(e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
			/^\d+$/.test(drafts[i])
		) {
			e.preventDefault();
			const meta = CRON_FIELDS[i];
			const n = Math.min(
				Math.max(Number(drafts[i]) + (e.key === 'ArrowUp' ? 1 : -1), meta.min),
				meta.max
			);
			drafts[i] = String(n);
			commit();
		}
	}

	/** Click an example chip → it fills the active cell (normalized) — the
	 *  preview updates live, teaching the operator by doing. */
	function applyExample(ex: string) {
		drafts[focusedIdx] = normalizeToken(ex);
		commit();
		focusField(focusedIdx);
	}

	function fieldPaste(i: number, e: ClipboardEvent) {
		const text = e.clipboardData?.getData('text') ?? '';
		if (!/\s/.test(text.trim())) return; // single-token paste → normal filter
		e.preventDefault();
		drafts = distributePaste(drafts, text, i);
		commit();
		focusField(Math.min(i + text.trim().split(/\s+/).length, CRON_FIELDS.length - 1));
	}

	const OPS: {
		token: string;
		key: string;
		ex?: keyof CronFieldMeta['examples'];
	}[] = [
		{ token: '*', key: 'app.widgets.cron_input.token.star' },
		{ token: ',', key: 'app.widgets.cron_input.token.comma', ex: 'comma' },
		{ token: '-', key: 'app.widgets.cron_input.token.dash', ex: 'dash' },
		{ token: '/', key: 'app.widgets.cron_input.token.slash', ex: 'slash' },
	];
</script>

<div class={cn('space-y-1.5', className)} data-testid={dataTestId && `${dataTestId}-root`}>
	<!-- UOM row — localized ≤4-char abbreviations ABOVE their cells. -->
	<div class="grid grid-cols-5 pr-[4.5rem]">
		{#each fieldStates as s, i (s.meta.key)}
			<button
				type="button"
				onclick={() => focusField(i)}
				class={cn(
					'min-w-0 px-0.5 text-center text-[10px] font-semibold tracking-widest uppercase transition-colors',
					i === focusedIdx
						? 'text-primary'
						: s.state === 'invalid'
							? 'text-destructive'
							: 'text-muted-foreground hover:text-foreground'
				)}
				data-testid={dataTestId && `${dataTestId}-uom-${s.meta.key}`}
			>
				{$t(s.meta.uom_key)}
			</button>
		{/each}
	</div>

	<!-- ONE continuous bar inside the canonical input chrome — the
	     primary-gradient border wraps the WHOLE cell set (the mask lives
	     inside the chrome), with the canonical eraser trailing CTA. -->
	<div class="relative">
		<div
			class={cn(
				'grid h-9 grid-cols-5 divide-x rounded-md border-primary-gradient bg-background pr-[4.5rem] shadow-xs transition-all',
				'hover:brightness-105 focus-within:ring-2 focus-within:ring-ring',
				hasInvalid && 'border-destructive'
			)}
			data-testid={dataTestId && `${dataTestId}-grid`}
		>
			{#each fieldStates as s, i (s.meta.key)}
				<!-- // standards-exempt: native-control — this component IS the canonical cron field input primitive -->
				<input
					bind:this={inputEls[i]}
					type="text"
					value={s.token}
					{disabled}
					placeholder="*"
					aria-label={$t(s.meta.label_key)}
					aria-invalid={s.state === 'invalid' || undefined}
					class={cn(
						'h-full w-full min-w-0 bg-transparent px-0.5 text-center font-mono transition-colors outline-none',
						s.token.length > 5 ? 'text-[11px]' : 'text-sm',
						i === focusedIdx && 'bg-accent/50',
						s.state === 'invalid' && 'bg-destructive/10 text-destructive',
						i === flashIdx && 'bg-destructive/20'
					)}
					data-testid={dataTestId && `${dataTestId}-field-${s.meta.key}`}
					oninput={(e) => fieldInput(i, e)}
					onkeydown={(e) => fieldKeydown(i, e)}
					onpaste={(e) => fieldPaste(i, e)}
					onfocus={() => (focusedIdx = i)}
				/>
			{/each}
		</div>
		<!-- Legend toggle — the LD second trailing slot (`right-10`), left of
		     the rightmost eraser. Born hidden; aria-pressed reflects state. -->
		<button
			type="button"
			onclick={() => (showLegend = !showLegend)}
			aria-label={$t('app.widgets.cron_input.legend')}
			title={$t('app.widgets.cron_input.legend')}
			aria-pressed={showLegend}
			tabindex={-1}
			{disabled}
			class={cn(inputTrailingIconButtonClasses, 'right-10', showLegend && 'text-foreground')}
			data-testid={dataTestId && `${dataTestId}-legend-toggle`}
		>
			<Info class="size-4" />
		</button>
		<button
			type="button"
			onclick={() => {
				drafts = ['', '', '', '', ''];
				commit();
				focusField(0);
			}}
			aria-label={$t('app.common.reset')}
			title={$t('app.common.reset')}
			tabindex={-1}
			disabled={disabled || drafts.every((d) => d === '')}
			class={inputTrailingIconButtonClasses}
			data-testid={dataTestId && `${dataTestId}-clear`}
		>
			<Eraser class="size-4" />
		</button>
	</div>

	<!-- The hero: the FINAL result — the *-filled expression described
	     verbatim (empty = `*`), centered, italic, quoted, foreground. -->
	<div class="min-h-6 pt-0.5 text-center" data-testid={dataTestId && `${dataTestId}-desc`}>
		{#if firstInvalid}
			<p class="text-sm font-medium text-destructive italic">
				{$t(firstInvalid.meta.label_key)}: {$t('app.widgets.cron_input.hint.invalid')}
			</p>
		{:else if description?.kind === 'text'}
			<p class="text-sm font-medium italic">“{description.text}”</p>
		{/if}
	</div>
	<!-- Legend — OFF by default (toggle in the input's second trailing
	     slot). Fully contextual to the ACTIVE cell: first row shows the
	     field's UOM + allowed range; every operator row carries a real,
	     clickable example for that cell. -->
	{#if showLegend}
		<div class="text-center" data-testid={dataTestId && `${dataTestId}-legend`}>
			<p class="text-[11px] text-muted-foreground">
				<code class="rounded bg-muted px-1 font-semibold text-primary">{$t(activeMeta.uom_key)}</code>
				<span class="font-mono">{activeMeta.range_hint}</span>
			</p>
			<ul class="mt-0.5 inline-block space-y-0.5 text-left text-[11px] text-muted-foreground">
				{#each OPS as op (op.token)}
					{@const ex = op.ex ? activeMeta.examples[op.ex] : op.token}
					<li class="flex items-center gap-1.5">
						<code class="inline-block w-4 rounded bg-muted text-center font-semibold">{op.token}</code>
						<span class="flex-1">{$t(op.key)}</span>
						<button
							type="button"
							onclick={() => applyExample(ex)}
							{disabled}
							class="ml-3 rounded border border-border bg-muted/50 px-1 font-mono transition-colors hover:border-primary hover:text-foreground disabled:pointer-events-none"
							data-testid={dataTestId && `${dataTestId}-example-${ex}`}
						>
							{ex}
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Next-run previews are computed by the parent schedule component
	     (its own badge strip) — this editor stays pure. -->
</div>
