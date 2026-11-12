<script lang="ts">
	import * as Popover from '../popover/index.js';
	import Button from '../button/button.svelte';
	import { Calendar, Clock, CircleAlert } from '@primebrick/ui/vendor/lucide'
	import { DateFormatter, getLocalTimeZone, today, now, CalendarDate, CalendarDateTime } from "@internationalized/date";
	import { cn, getResolvedIanaTimeZone } from "../../utils/index.js";
	import { isWheelSelectionBelowMin } from "../../utils/date-wheel-bounds.js";
	import { WheelPicker, WheelPickerItem, WheelPickerGroup } from '../wheel-picker/index.js';
	import { getT, getLocale } from "../../bridges.js";
	import { ButtonGroup } from '../button-group/index.js';
	import { KeyboardHints } from '../keyboard-hints/index.js';
	import { onMount } from "svelte";
	import { ComboSelect } from '../combo-select/index.js';

	const t = getT();
	const uiLang = getLocale();

	/**
	 * `minValue` — lower bound as an absolute instant (`Date`). When set the
	 * picker REFUSES to commit a selection before it: the wheels can spin
	 * below the bound (visual feedback via the error strip), the bound
	 * `value` keeps the last acceptable value, and Done cannot close the
	 * popover. `includeTime` compares the instant the wheels + picked
	 * timezone resolve to; date-only compares calendar days; `timeOnly`
	 * carries no calendar so the bound is not applicable.
	 */
	let { value = $bindable(), placeholder = $t("app.common.select_date"), includeTime = false, timeOnly = false, defaultTime = undefined, minValue = undefined, timezone = $bindable(), dataTestId = undefined, id = undefined, disabled = false } = $props();
	let isOpen = $state(false);
	let activeTab = $state<"date" | "time">("date");

	let df = $derived(new DateFormatter(uiLang(), timeOnly ? { timeStyle: "medium" } : includeTime ? { dateStyle: "long", timeStyle: "medium" } : { dateStyle: "long" }));
	let monthFormatter = $derived(new DateFormatter(uiLang(), { month: "short" }));

	// Generate date data
	const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
	const months = Array.from({ length: 12 }, (_, i) =>
		monthFormatter.format(new CalendarDate(today(getLocalTimeZone()).year, i + 1, 1).toDate(getLocalTimeZone()))
	);
	const currentYear = today(getLocalTimeZone()).year;
	// With a lower bound, years before it can never produce an acceptable
	// value — the wheel starts at the bound's year instead of offering
	// dead options.
	const years = $derived.by(() => {
		const firstYear = minValue ? minValue.getFullYear() : currentYear - 50;
		const count = minValue ? Math.max(50, currentYear + 50 - firstYear + 1) : 100;
		return Array.from({ length: count }, (_, i) => (firstYear + i).toString());
	});
	const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
	const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));
	const seconds = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

	// Compute initial time values
	function getInitialTime() {
		if (defaultTime) {
			const [hours, minutes, seconds] = defaultTime.split(":").map(Number);
			return {
				hour: hours.toString().padStart(2, "0"),
				minute: minutes.toString().padStart(2, "0"),
				second: (seconds || 0).toString().padStart(2, "0")
			};
		} else if (includeTime) {
			const currentTime = now(getLocalTimeZone());
			return {
				hour: currentTime.hour.toString().padStart(2, "0"),
				minute: currentTime.minute.toString().padStart(2, "0"),
				second: currentTime.second.toString().padStart(2, "0")
			};
		}
		return { hour: "00", minute: "00", second: "00" };
	}

	const initialTime = getInitialTime();

	let selectedDay = $state("");
	let selectedMonth = $state("");
	let selectedYear = $state("");
	let selectedHour = $state(initialTime.hour);
	let selectedMinute = $state(initialTime.minute);
	let selectedSecond = $state(initialTime.second);
	let hasUserInteracted = $state(false);
	let belowMin = $state(false);

	// Reopening re-syncs the wheels to `value` — a stale refusal must not
	// survive into the fresh selection.
	$effect(() => {
		if (isOpen) belowMin = false;
	});

	/**
	 * Refusal check on the candidate a wheel selection would commit —
	 * delegated to `isWheelSelectionBelowMin` (instant compare for
	 * includeTime, calendar-day compare for date-only).
	 */
	function isBelowMin(candidate: CalendarDate | CalendarDateTime): boolean {
		return isWheelSelectionBelowMin(candidate, minValue, selectedTimezone || undefined);
	}

	// Timezone state
	let selectedTimezone = $state<string>(timezone ?? "UTC");
	let browserTimezone = $state<string | null>(null);

	onMount(() => {
		browserTimezone = getResolvedIanaTimeZone();
		if (!timezone && browserTimezone) {
			selectedTimezone = browserTimezone;
		}
	});

	// Sync timezone with prop
	$effect(() => {
		timezone = selectedTimezone;
	});

	// Get all IANA timezones supported by the browser
	const allTimezones = $derived(() => {
		let timezones: string[];
		try {
			timezones = Intl.supportedValuesOf('timeZone').sort();
		} catch {
			// Fallback to common timezones if Intl.supportedValuesOf is not supported
			timezones = [
				"UTC",
				"Europe/Rome",
				"Europe/London",
				"Europe/Paris",
				"Europe/Berlin",
				"Europe/Madrid",
				"America/New_York",
				"America/Los_Angeles",
				"America/Chicago",
				"Asia/Tokyo",
				"Asia/Shanghai",
				"Asia/Dubai",
				"Australia/Sydney",
				"Australia/Melbourne",
			];
		}
		return timezones;
	});

	// Refresh time to NOW each time the popover opens (if user hasn't interacted and no value set)
	$effect(() => {
		if (isOpen && includeTime && !hasUserInteracted && !value) {
			const fresh = getInitialTime();
			selectedHour = fresh.hour;
			selectedMinute = fresh.minute;
			selectedSecond = fresh.second;
		}
	});

	// Initialize wheelers to today if no value provided, otherwise sync with value
	$effect(() => {
		if (timeOnly) {
			// timeOnly mode — only sync time wheels, ignore date
			if (value && "hour" in value) {
				selectedHour = value.hour.toString().padStart(2, "0");
				selectedMinute = value.minute.toString().padStart(2, "0");
				selectedSecond = value.second.toString().padStart(2, "0");
			} else if (!hasUserInteracted) {
				const fresh = getInitialTime();
				selectedHour = fresh.hour;
				selectedMinute = fresh.minute;
				selectedSecond = fresh.second;
			}
			return;
		}
		if (value) {
			selectedDay = value.day.toString();
			selectedMonth = months[value.month - 1];
			selectedYear = value.year.toString();
			if (includeTime && "hour" in value) {
				selectedHour = value.hour.toString().padStart(2, "0");
				selectedMinute = value.minute.toString().padStart(2, "0");
				selectedSecond = value.second.toString().padStart(2, "0");
			}
		} else if (!hasUserInteracted) {
			const todayDate = today(getLocalTimeZone());
			selectedDay = todayDate.day.toString();
			selectedMonth = months[todayDate.month - 1];
			selectedYear = todayDate.year.toString();
		}
	});

	// Reset to today when value is cleared
	$effect(() => {
		if (!value && hasUserInteracted) {
			hasUserInteracted = false;
			const todayDate = today(getLocalTimeZone());
			selectedDay = todayDate.day.toString();
			selectedMonth = months[todayDate.month - 1];
			selectedYear = todayDate.year.toString();
			selectedHour = "00";
			selectedMinute = "00";
			selectedSecond = "00";
		}
	});

	// Update value when selections change
	function updateValue() {
		hasUserInteracted = true;
		if (timeOnly) {
			// timeOnly mode — store as Time value (no date component)
			// Use CalendarDateTime with today's date as a carrier for the time
			const todayDate = today(getLocalTimeZone());
			value = new CalendarDateTime(
				todayDate.year,
				todayDate.month,
				todayDate.day,
				parseInt(selectedHour),
				parseInt(selectedMinute),
				parseInt(selectedSecond)
			);
			return;
		}
		if (selectedDay && selectedMonth && selectedYear) {
			const monthIndex = months.indexOf(selectedMonth);
			if (monthIndex !== -1) {
				let candidate: CalendarDate | CalendarDateTime;
				try {
					candidate = includeTime
						? new CalendarDateTime(
							parseInt(selectedYear),
							monthIndex + 1,
							parseInt(selectedDay),
							parseInt(selectedHour),
							parseInt(selectedMinute),
							parseInt(selectedSecond)
						)
						: new CalendarDate(
							parseInt(selectedYear),
							monthIndex + 1,
							parseInt(selectedDay)
						);
				} catch {
					// Handle invalid dates (e.g., Feb 30)
					const tempDate = new CalendarDate(
						parseInt(selectedYear),
						monthIndex + 1,
						1
					);
					const lastDay = tempDate.calendar.getDaysInMonth(tempDate);
					const validDay = Math.min(parseInt(selectedDay), lastDay);
					candidate = includeTime
						? new CalendarDateTime(
							parseInt(selectedYear),
							monthIndex + 1,
							validDay,
							parseInt(selectedHour),
							parseInt(selectedMinute),
							parseInt(selectedSecond)
						)
						: new CalendarDate(
							parseInt(selectedYear),
							monthIndex + 1,
							validDay
						);
				}
				if (isBelowMin(candidate)) {
					// Refuse to commit — the bound `value` keeps the last
					// acceptable value and the strip explains why Done
					// cannot close the popover.
					belowMin = true;
					return;
				}
				belowMin = false;
				value = candidate;
			}
		}
	}

	function confirm() {
		updateValue();
		if (belowMin) return;
		isOpen = false;
	}

	/**
	 * Keyboard contract for the dropdown:
	 * - ANY arrow key outside the wheels (tabs, timezone, footer, body) jumps
	 *   focus straight to the first wheel column — the fast path that skips
	 *   the whole tab-index round trip. ↑/↓ also roll the wheel immediately
	 *   (the key is re-dispatched so the column's own step contract runs it).
	 *   Inside wheels the column keydown steps / moves between siblings.
	 * - Enter submits the dropdown (same as the Done CTA) unless the target
	 *   is an interactive control that owns Enter itself.
	 * - Esc is the native popover dismiss — same as the Close CTA.
	 */
	function handlePickerKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		if (e.key.startsWith('Arrow')) {
			if (target.closest('[data-slot="wheel-picker"]')) return;
			if (target.closest('input, textarea')) return;
			e.preventDefault();
			const first = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(
				'[data-slot="wheel-picker-group"]'
			);
			first?.focus();
			if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
				first?.dispatchEvent(new KeyboardEvent('keydown', { key: e.key, bubbles: true }));
			}
			return;
		}
		if (e.key === 'Enter') {
			if (target.closest('button, input, textarea, [role="combobox"], [role="tab"]')) return;
			e.preventDefault();
			confirm();
		}
	}
</script>

<Popover.Root bind:open={isOpen}>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				id={id ?? props.id}
				{disabled}
				variant="outline"
				class="w-full justify-between font-normal"
				data-testid={dataTestId}
			>
				<span class={cn(!value && "text-muted-foreground/70 text-xs")}>
					{value ? df.format(value.toDate(getLocalTimeZone())) : placeholder}
				</span>
				{#if timeOnly}
					<Clock class="ml-2 h-4 w-4 opacity-50" />
				{:else}
					<Calendar class="ml-2 h-4 w-4 opacity-50" />
				{/if}
			</Button>
		{/snippet}
	</Popover.Trigger>

	<Popover.Content
		class="w-[440px] p-0 shadow-2xl border-border rounded-none overflow-hidden bg-popover"
		align="start"
		onkeydown={handlePickerKeydown}
	>
		{#if timeOnly}
			<!-- timeOnly mode: only time wheels, no date, no tabs, no timezone -->
			<WheelPicker>
				<WheelPickerGroup bind:value={selectedHour} onValueChange={updateValue}>
					{#each hours as hour (hour)}
						<WheelPickerItem value={hour}>
							{hour}
						</WheelPickerItem>
					{/each}
				</WheelPickerGroup>
				<WheelPickerGroup bind:value={selectedMinute} onValueChange={updateValue}>
					{#each minutes as minute (minute)}
						<WheelPickerItem value={minute}>
							{minute}
						</WheelPickerItem>
					{/each}
				</WheelPickerGroup>
				<WheelPickerGroup bind:value={selectedSecond} onValueChange={updateValue}>
					{#each seconds as second (second)}
						<WheelPickerItem value={second}>
							{second}
						</WheelPickerItem>
					{/each}
				</WheelPickerGroup>
			</WheelPicker>
		{:else if includeTime}
			<div class="flex flex-col h-full">
				<!-- DATA/ORA mode toggle — the SAME segmented ButtonGroup anatomy
				     every mode surface uses (filters std/adv, ELT view mode):
				     ghost buttons + aria-pressed, semantic icon carries the side. -->
				<ButtonGroup segmented class="w-full h-10 rounded-none border-b bg-muted/50 px-1 py-1">
					<Button
						variant="ghost"
						size="sm"
						type="button"
						class="flex-1 {activeTab === 'date'
							? 'bg-foreground/10 text-foreground shadow-xs'
							: 'text-muted-foreground'}"
						aria-pressed={activeTab === 'date'}
						data-testid={dataTestId ? `${dataTestId}-date-tab` : undefined}
						onclick={() => (activeTab = 'date')}
					>
						<Calendar class="size-4" />
						{$t("app.common.date")}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						type="button"
						class="flex-1 {activeTab === 'time'
							? 'bg-foreground/10 text-foreground shadow-xs'
							: 'text-muted-foreground'}"
						aria-pressed={activeTab === 'time'}
						data-testid={dataTestId ? `${dataTestId}-time-tab` : undefined}
						onclick={() => (activeTab = 'time')}
					>
						<Clock class="size-4" />
						{$t("app.common.time")}
					</Button>
				</ButtonGroup>

				{#if activeTab === "time"}
					<div class="px-4 py-2 border-b border-border">
						<ComboSelect
							mode="single"
							bind:value={selectedTimezone}
							options={allTimezones()}
							placeholder={$t("app.common.select_timezone")}
							dataTestId="date-wheel-picker-timezone"
						/>
					</div>
				{/if}

				<div class="flex-1 overflow-hidden mt-0">
					{#if activeTab === "date"}
						<WheelPicker>
							<WheelPickerGroup bind:value={selectedDay} onValueChange={updateValue}>
								{#each days as day (day)}
									<WheelPickerItem value={day}>
										{day}
									</WheelPickerItem>
								{/each}
							</WheelPickerGroup>
							<WheelPickerGroup bind:value={selectedMonth} onValueChange={updateValue}>
								{#each months as month (month)}
									<WheelPickerItem value={month}>
										{month.slice(0, 3)}
									</WheelPickerItem>
								{/each}
							</WheelPickerGroup>
							<WheelPickerGroup bind:value={selectedYear} onValueChange={updateValue}>
								{#each years as year (year)}
									<WheelPickerItem value={year}>
										{year}
									</WheelPickerItem>
								{/each}
							</WheelPickerGroup>
						</WheelPicker>
					{:else}
						<WheelPicker>
							<WheelPickerGroup bind:value={selectedHour} onValueChange={updateValue}>
								{#each hours as hour (hour)}
									<WheelPickerItem value={hour}>
										{hour}
									</WheelPickerItem>
								{/each}
							</WheelPickerGroup>
							<WheelPickerGroup bind:value={selectedMinute} onValueChange={updateValue}>
								{#each minutes as minute (minute)}
									<WheelPickerItem value={minute}>
										{minute}
									</WheelPickerItem>
								{/each}
							</WheelPickerGroup>
							<WheelPickerGroup bind:value={selectedSecond} onValueChange={updateValue}>
								{#each seconds as second (second)}
									<WheelPickerItem value={second}>
										{second}
									</WheelPickerItem>
								{/each}
							</WheelPickerGroup>
						</WheelPicker>
					{/if}
				</div>
			</div>
		{:else}
			<WheelPicker>
				<WheelPickerGroup bind:value={selectedDay} onValueChange={updateValue}>
					{#each days as day (day)}
						<WheelPickerItem value={day}>
							{day}
						</WheelPickerItem>
					{/each}
				</WheelPickerGroup>
				<WheelPickerGroup bind:value={selectedMonth} onValueChange={updateValue}>
					{#each months as month (month)}
						<WheelPickerItem value={month}>
							{month.slice(0, 3)}
						</WheelPickerItem>
					{/each}
				</WheelPickerGroup>
				<WheelPickerGroup bind:value={selectedYear} onValueChange={updateValue}>
					{#each years as year (year)}
						<WheelPickerItem value={year}>
							{year}
						</WheelPickerItem>
					{/each}
				</WheelPickerGroup>
			</WheelPicker>
		{/if}

		{#if belowMin}
			<div
				class="flex items-center gap-1.5 border-t bg-destructive/10 px-3 py-1.5 text-xs text-destructive"
				data-testid={dataTestId ? `${dataTestId}-below-min` : undefined}
			>
				<CircleAlert class="size-3.5 shrink-0" />
				<span>{$t('app.common.validation.datetime_before_min', { min: df.format(minValue) })}</span>
			</div>
		{/if}

		<!-- Footer — canonical KeyboardHints legend + right-aligned xs CTAs. -->
		<KeyboardHints
			class="border-t bg-muted/50 px-3 py-1.5"
			hints={[
				{ keys: ['↑', '↓', '←', '→'] },
				{ keys: ['⏎'] },
				{ keys: ['esc'], size: 'modifier' },
			]}
		>
			{#snippet end()}
				<div class="flex gap-2">
					<Button variant="secondary" size="xs" onclick={() => (isOpen = false)}>{$t('app.common.close')}</Button>
					<Button size="xs" onclick={confirm}>{$t('app.common.done')}</Button>
				</div>
			{/snippet}
		</KeyboardHints>
	</Popover.Content>
</Popover.Root>
