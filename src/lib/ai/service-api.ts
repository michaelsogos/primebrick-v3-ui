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
