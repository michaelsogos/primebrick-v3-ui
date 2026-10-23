/**
 * AI domain types — consumption mirror of the ai service's API contract
 * (`/ws/ai/api/v1/entities/ai_model`, `ai_cerebellum`). Domain truth stays
 * service-side (BE/OpenAPI); these live in the vendored plane because BOTH
 * realms consume them — shell chrome (assistant sheets/chat) and remote
 * module pages/chunks — and the vendor import map is the only path that
 * reaches both.
 */

/**
 * AI model entity — mirrors the BE `ai_models` table (Transformers.js/ONNX
 * model catalog). Legacy per-case test shape (`regex_test_score` entries).
 */
export type TestCaseScore = {
  runs: number[];
  score: number;
  method: string;
  updated_at: string;
};

export type ExecutionConfig = {
  kv_cache_reuse: boolean;
  sliding_window: boolean;
  max_history_turns: number;
  intent_detection: boolean;
  /** RAG assistants only: min cosine similarity for a retrieved chunk to enter the prompt. */
  min_similarity?: number;
  /** ORT InferenceSession options (snake_case keys, camelized by the worker) —
   *  e.g. { enable_mem_pattern: false, enable_cpu_mem_arena: false } reduces
   *  wasm-heap pressure on fp32-activation dtypes. */
  ort_session_options?: Record<string, unknown>;
  /** env.wasm.numThreads override — 1 removes the pthread allocator path. */
  ort_num_threads?: number;
  /** Guide ReAct cerebellums only: agent prompt/tool-response dialect.
   *  'react_classic' (default) = Thought/Action/Action Input + Observation;
   *  'qwen_tool_call' = <tool_call>{json}</tool_call> + tool-role responses. */
  agent_dialect?: 'react_classic' | 'qwen_tool_call';
  /** Guide cerebellums only: 'in_context' (default) collapses answer+action
   *  stages into the agent conversation (delta-prefill); 'separate_prompt'
   *  restores the classic fresh-conversation S3/S4 (smaller prompts, needed
   *  for models that cannot reuse the KV cache). */
  answer_mode?: 'in_context' | 'separate_prompt';
};

export type AiModel = {
  uuid: string;
  model_id: string;
  dtype?: string | null;
  engine_type: string;
  name: string;
  label_key?: string | null;
  description_key?: string | null;
  power_level: number;
  rank: number;
  /** Heterogeneous JSONB — see normalizeTestScores() in the /ai page. */
  test_scores?: Record<string, unknown> | null;
  enable_thinking: boolean;
  temperature: number;
  top_p: number;
  max_tokens: number;
  repetition_penalty: number;
  sort_order: number;
  download_size_mb?: number | null;
  vram_mb?: number | null;
  /** Architecture-derived agnostic metrics (from HF config.json — see patch). */
  kv_cache_bytes_per_token?: number | null;
  flops_per_token?: number | null;
  working_set_mb?: number | null;
  /** 'hf_estimate' = COALESCE(vram_mb,download)+kv×8192;
   *  'e2e_measured' = GPUBuffer-tracked total (KV already inside). */
  working_set_source?: 'hf_estimate' | 'e2e_measured';
  working_set_detail?: {
    weights_mb?: number;
    kv_mb?: number;
    ctx_ref?: number;
    measured_vram_bytes?: number;
    measured_at?: string;
    measured_ctx_tokens?: number | null;
  } | null;
  is_compatible: boolean;
  execution_config?: ExecutionConfig | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  version: number;
  deleted_at?: string;
  deleted_by?: string;
};

/**
 * Variant identity of an ai_models row: "<model_id>#<dtype>". `model_id` is the
 * bare HF repo (storage is normalized); the dtype suffix is derived, never
 * stored. Use this wherever a specific quantization must be identified —
 * cache keys, cerebellum refs, config values, testids, assistant state.
 */
export function modelVariantKey(m: { model_id: string; dtype?: string | null }): string {
  return m.dtype ? `${m.model_id}#${m.dtype}` : m.model_id;
}

/**
 * `ai_cerebellum` row — per-assistant tuning preset for a model.
 * NULL param fields mean "inherit the ai_models default".
 */
export type AiCerebellum = {
  uuid: string;
  assistant_key: string;
  model_id: string;
  /** Model variant dtype (e.g. 'q4f16'); null/undefined = unquantized/default
   *  variant. Runtime variant key = `${model_id}#${dtype}` (modelVariantKey()). */
  dtype?: string | null;
  /** Tuning name shown in the chat footer dropdown (e.g. 'default', 'precise'). */
  name: string;
  description_key?: string | null;
  enable_thinking?: boolean | null;
  temperature?: number | null;
  top_p?: number | null;
  max_tokens?: number | null;
  repetition_penalty?: number | null;
  /** Partial override merged over ai_models.execution_config. NULL = inherit all. */
  execution_config?: Partial<ExecutionConfig> | null;

  /** Per-tuning test measurements keyed by test case. */
  test_scores?: Record<string, unknown> | null;
  /** Visual recommendation badge — cosmetic only, no effect on selection/execution. */
  recommendation?: 'RECOMMENDED' | 'NOT_RECOMMENDED' | null;
  /** Per-assistant compatibility — false hides this (assistant, model, dtype)
   *  from that assistant's model picker. Mandatory, defaults true. */
  is_compatible: boolean;
  /** Per-assistant default model — at most one row per assistant_key. */
  is_default: boolean;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
  version: number;
  deleted_at?: string;
  deleted_by?: string;
};
