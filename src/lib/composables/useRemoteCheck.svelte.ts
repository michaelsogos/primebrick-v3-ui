/**
 * UseRemoteCheck — debounced async availability-probe state machine.
 *
 * The host owns WHAT to probe (a `check-exists` unique group, an authored
 * registry endpoint, …); this class owns the lifecycle every async field
 * probe shares:
 *
 *   - `schedule(probe)` resets the debounce timer and captures the probe
 *     closure for the CURRENT value set — a stale in-flight response can
 *     never overwrite a newer schedule (generation guard);
 *   - `reset()` drops back to `idle` (the value set went incomplete);
 *   - states: `idle` → `checking` → `available` | `taken` | `error`.
 *     `error` is the probe transport failing — NEVER a validation verdict:
 *     surfaces must not block submit on it (the BE constraint enforces).
 *
 * ## Usage
 * ```ts
 * const rc = new UseRemoteCheck();
 * rc.schedule(async () => (await fetchAvailability(name)).available);
 * ```
 */
export type RemoteCheckState = "idle" | "checking" | "available" | "taken" | "error";

/** Probe contract — resolves `true` when the value set is AVAILABLE. */
export type RemoteCheckProbe = () => Promise<boolean>;

export class UseRemoteCheck {
	#state = $state<RemoteCheckState>("idle");
	#generation = 0;
	#timer: ReturnType<typeof setTimeout> | undefined = undefined;
	private debounceMs: number;

	constructor({ debounceMs = 300 }: Partial<{ debounceMs: number }> = {}) {
		this.debounceMs = debounceMs;
	}

	get state(): RemoteCheckState {
		return this.#state;
	}

	/** `true` while a verdict is pending — submit must wait for it. */
	get pending(): boolean {
		return this.#state === "checking";
	}

	/** `true` on a proven conflict — the only submit-blocking verdict. */
	get conflicted(): boolean {
		return this.#state === "taken";
	}

	/** Schedule a probe after the debounce window. Each call invalidates
	 *  the previous one — timer AND in-flight response. */
	schedule(probe: RemoteCheckProbe): void {
		const gen = ++this.#generation;
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => {
			void (async () => {
				if (gen !== this.#generation) return;
				this.#state = "checking";
				try {
					const available = await probe();
					if (gen !== this.#generation) return; // stale — a newer schedule owns the state
					this.#state = available ? "available" : "taken";
				} catch {
					if (gen === this.#generation) this.#state = "error";
				}
			})();
		}, this.debounceMs);
	}

	/** Back to idle — the value set is incomplete or the field unmounted. */
	reset(): void {
		this.#generation++;
		clearTimeout(this.#timer);
		this.#state = "idle";
	}
}
