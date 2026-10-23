/**
 * `ui/ai/` — AI-domain leaf libs (consumption mirror; domain truth stays
 * service-side). Importable as `@primebrick/ui/ai` — a narrow subpath that
 * does NOT pull the component/vendor barrel (tests and remote chunks only
 * pay for what they import).
 */
export * from './types.js';
export * from './ai-model-test-scores.js';
export * from './ai-cerebellum.js';
export * from './resumable-fetch.js';
