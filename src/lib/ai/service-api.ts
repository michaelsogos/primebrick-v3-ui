/**
 * ai service entity fetches — ride the named `'ai'` service-api slot so the
 * same code runs in BOTH realms:
 *
 * - host realm: `bindServiceApi('ai', p => apiFetch('/ws/ai' + p))` (host-bindings)
 * - remote realm: `bindRemoteCtx(ctx, { service: 'ai' })` → `ctx.api`
 *   (already `/ws/ai`-bound by the host for ai-owned mounts)
 *
 * Paths are service-relative (`/api/v1/…`) — the slot prepends `/ws/ai`.
 */
import { extJsonStringify } from '@primebrick/core';
import { getServiceApi } from '../bridges.js';
import type { AiCerebellum, AiModel } from './types.js';

export async function fetchAiModels(deletedRecords?: 'EXCLUDED' | 'ONLY' | 'INCLUDED'): Promise<AiModel[]> {
	// The selector expects the full catalog. page_size is capped at 100 by the
	// BE, and deleted+alive rows can exceed that — paginate until exhausted.
	const api = getServiceApi('ai');
	const rows: AiModel[] = [];
	let page = 1;
	for (;;) {
		const params = new URLSearchParams({ page_size: '100', page: String(page) });
		if (deletedRecords) params.set('deleted_records', deletedRecords);
		const res = await api(`/api/v1/entities/ai_model/list?${params}`);
		if (!res.ok) throw new Error(`AI models fetch failed (${res.status})`);
		const data = (await res.json()) as { rows: AiModel[]; total?: number };
		rows.push(...data.rows);
		if (data.rows.length < 100 || (data.total !== undefined && rows.length >= data.total)) break;
		page++;
	}
	return rows;
}

export async function fetchAiCerebellum(filters?: {
	assistant_key?: string;
	model_id?: string;
}): Promise<AiCerebellum[]> {
	const params = new URLSearchParams();
	params.set('page_size', '100');
	// Canonical qs bracket notation — parsed by Express qs into objects the DAL
	// filter translator consumes directly (no JSON.stringify anywhere).
	let i = 0;
	for (const [field, value] of [
		['assistant_key', filters?.assistant_key],
		['model_id', filters?.model_id],
	] as const) {
		if (!value) continue;
		params.set(`filters[${i}][field]`, field);
		params.set(`filters[${i}][op]`, '=');
		params.set(`filters[${i}][value]`, value);
		i++;
	}
	if (i > 0) params.set('connector', 'AND');
	const url = `/api/v1/entities/ai_cerebellum/list?${params.toString()}`;
	const res = await getServiceApi('ai')(url);
	if (!res.ok) throw new Error(`AI cerebellum fetch failed (${res.status})`);
	const data = (await res.json()) as { rows: AiCerebellum[] };
	return data.rows;
}

// ─── Module config entries (ai-schema-owned config rows) ────────────────────

/** Row shape of `ai.config_entries` as served by the ai config_entry routes. */
export type AiConfigEntry = {
	uuid: string;
	key: string;
	value: string | null;
	type?: string;
	label_key?: string;
	description_key?: string;
	group_key?: string;
	reserved?: boolean;
	version: number;
};

export async function fetchAiConfigEntries(): Promise<AiConfigEntry[]> {
	const res = await getServiceApi('ai')('/api/v1/entities/config_entry/list');
	if (!res.ok) throw new Error(`Config fetch failed (${res.status})`);
	const data = (await res.json()) as { config_entries: AiConfigEntry[] };
	return data.config_entries;
}

export async function updateAiConfigEntry(
	uuid: string,
	value: string | number | bigint,
	version: number,
): Promise<AiConfigEntry> {
	const res = await getServiceApi('ai')(
		`/api/v1/entities/config_entry/${encodeURIComponent(uuid)}`,
		{
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: extJsonStringify({ entity: { value, version } }),
		},
	);
	if (!res.ok) throw new Error(`Config update failed (${res.status})`);
	const data = (await res.json()) as { config_entries: AiConfigEntry };
	return data.config_entries;
}

// ─── Docs index admin (ai-owned knowledge-base index) ───────────────────────

export interface DocsIndexRepoRow {
	repo: string;
	docs: bigint;
	chunks: bigint;
	unembedded_chunks: bigint;
	content_bytes: bigint;
	vector_bytes: bigint;
}

export interface DocsIndexDrift {
	service: string;
	repo?: string;
	error?: string;
	expected_docs?: bigint;
	expected_chunks?: bigint;
	missing_from_index?: string[];
	stale?: string[];
	orphans?: string[];
	unembedded_chunks?: bigint;
}

export interface DocsIngestLogRow {
	id: bigint;
	repo: string | null;
	service_code: string;
	trigger_source: string;
	ok: boolean;
	stats: Record<string, unknown>;
	error: string | null;
	created_at: string;
}

export interface DocsIndexProbe {
	query: string;
	expect_path_includes: string;
	ok: boolean;
	top: Array<{ repo: string; path: string; similarity: number }>;
}

export interface DocsIndexStatus {
	repos: DocsIndexRepoRow[];
	drift: DocsIndexDrift[];
	history: DocsIngestLogRow[];
	probes?: DocsIndexProbe[];
	storage: { total_bytes: bigint } | null;
}

export async function fetchDocsIndexStatus(probe = false): Promise<DocsIndexStatus> {
	const res = await getServiceApi('ai')(`/api/v1/ai/docs/index-status${probe ? '?probe=1' : ''}`);
	if (!res.ok) throw new Error(`Docs index status failed (${res.status})`);
	return (await res.json()) as DocsIndexStatus;
}

export interface DocsReindexResult {
	service: string;
	repo?: string;
	ok: boolean;
	stats?: Record<string, unknown>;
	error?: string;
}

export async function reindexDocsPacks(repo?: string): Promise<DocsReindexResult[]> {
	const res = await getServiceApi('ai')('/api/v1/ai/reindex', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: extJsonStringify({ mode: 'packs', ...(repo ? { repo } : {}) }),
	});
	if (!res.ok) throw new Error(`Reindex failed (${res.status})`);
	const data = (await res.json()) as { results: DocsReindexResult[] };
	return data.results;
}
