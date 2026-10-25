/**
 * useConfigEntries — singleton composable that fetches all config entries
 * once, caches them in `$state`, and exposes per-key lookups.
 *
 * Multiple components calling `useConfigEntries()` share the same cached
 * fetch (module-level singleton state — ONE instance per realm: host and
 * remote bundles each hold their own, by design).
 *
 * Caching layers:
 *   1. HTTP-level: the bound service api's ETag cache (If-None-Match → 304
 *      → synthetic 200 from localStorage). See `cache/etag-store.ts`.
 *   2. Session-level: this composable's in-memory `$state`. Once loaded,
 *      subsequent calls return immediately without hitting the network.
 *
 * `invalidate()` clears the ETag cache and marks the in-memory state as
 * stale, so the next `getValue()` call re-fetches. Call this after writes
 * (create/update/delete) so other components pick up the new values.
 *
 * `config_entry` rows are BE-owned → the fetch goes through the `'host'`
 * service-api slot (`bindServiceApi('host', apiFetch)` in the host app;
 * `bindRemoteCtx` binds it from `ctx.components.hostApi` in remotes).
 *
 * Follows the composable state exposure pattern:
 *   - `_state` is internal (underscore prefix)
 *   - Exposed via `get state()` returning `DeepReadonly`
 *   - Mutations only through exposed mutator functions
 */
import type { ConfigEntry } from '@primebrick/core';
import type { DeepReadonly } from '../utils/index.js';
import { getServiceApi } from '../bridges.js';
import { clearCachedETag } from '../cache/etag-store.js';

const CONFIG_ENTRIES_URL = '/api/v1/entities/config_entry/list';

// Module-level singleton — shared across all callers.
// svelte-ignore state_referenced_locally — module-level $state, intentionally shared.
const _state = $state({
	entries: [] as ConfigEntry[],
	loading: false,
	error: null as string | null,
	fetched: false,
});

let fetchPromise: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
	if (_state.fetched || _state.loading || fetchPromise) {
		return fetchPromise ?? Promise.resolve();
	}
	_state.loading = true;
	_state.error = null;
	fetchPromise = (async () => {
		try {
			const res = await getServiceApi('host')(CONFIG_ENTRIES_URL);
			if (!res.ok) throw new Error(`Config entries fetch failed (${res.status})`);
			const data = (await res.json()) as { rows: ConfigEntry[] };
			_state.entries = data.rows;
			_state.fetched = true;
		} catch (err) {
			_state.error = err instanceof Error ? err.message : 'Failed to load config';
		} finally {
			_state.loading = false;
			fetchPromise = null;
		}
	})();
	return fetchPromise;
}

export function useConfigEntries() {
	return {
		get state(): DeepReadonly<typeof _state> {
			return _state as DeepReadonly<typeof _state>;
		},
		getEntry(key: string): DeepReadonly<ConfigEntry> | undefined {
			void ensureLoaded();
			return _state.entries.find((e) => e.key === key);
		},
		getValue(key: string): string | bigint | number | null | undefined {
			void ensureLoaded();
			return _state.entries.find((e) => e.key === key)?.value;
		},
		async refresh(): Promise<void> {
			_state.fetched = false;
			_state.loading = false;
			fetchPromise = null;
			await ensureLoaded();
		},
		invalidate(): void {
			clearCachedETag(CONFIG_ENTRIES_URL);
			_state.fetched = false;
		},
		ensureLoaded,
	};
}
