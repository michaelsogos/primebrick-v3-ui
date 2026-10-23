import { getContext, setContext } from 'svelte';

const ENTITIES_NS_KEY = Symbol('entitiesNs');

/**
 * Set the entity-label i18n namespace for the table subtree — comes from
 * the served `meta.entities_ns` (service-owned entities e.g. `job`, `ai`) —
 * `'system'` for BE/core-owned entities.
 */
export function setEntitiesNsContext(ns: string) {
	setContext(ENTITIES_NS_KEY, ns);
}

/**
 * Entity-label namespace for the current table subtree — `'system'` is the
 * contract default for BE/core-owned entities (EntityMeta.entities_ns is
 * absent for them). `system.entities.list.*` / `system.entities.page_title.*`
 * are CORE shared vocabulary and stay `system` regardless.
 */
export function getEntitiesNsContext(): string {
	return getContext(ENTITIES_NS_KEY) ?? 'system';
}
