/**
 * bridges — host-bound capability slots consumed by `@primebrick/ui`
 * components and composables.
 *
 * The package is environment-neutral: it cannot import `$app/*`, `$lib/*`,
 * or the FE's auth fetch. Anything a moved component needs from the host —
 * translations, sheet panels, authenticated fetches — arrives through a
 * named slot bound at runtime:
 *
 * - HOST realm (the FE app bundles ui at build time) — bind once at app
 *   boot via `host-bindings.ts`: `bindI18n(t)`, `bindSheet(openSheet)`,
 *   `bindServiceApi('host', apiFetch)`,
 *   `bindServiceApi('ai', (p,i) => apiFetch('/ws/ai'+p, i))`.
 * - REMOTE realm (module pages resolve the vendored `primebrick-ui.js`
 *   through the import map — a second module instance) — the remote
 *   `mountPage` binds its OWN vendored copy once via
 *   `bindRemoteCtx(ctx)`, which wires the slots from the host-provided
 *   `ModulePageHost` ctx (`ctx.i18n.t`, `ctx.components.openSheet`,
 *   `ctx.components.mfaStepUp`, `ctx.components.hostApi`, `ctx.api`).
 *
 * i18n is bound as a `Readable<TranslateFn>` so call sites keep the same
 * `$t(key)` auto-subscription shape they had with `$lib/i18n` — reactivity
 * (language switch + BE dict merges) is preserved in the host realm. In
 * the remote realm `ctx.i18n.t` is already evaluated per call on the host
 * side, so wrapping it in `readable()` keeps identical semantics.
 *
 * An unbound getter throws a descriptive error — never a fake fallback.
 */

import { readable, type Readable } from 'svelte/store';
import type { MfaStepUpFn, ModulePageHost, OpenSheetFn } from '@primebrick/core';

/** Translation function shape — matches `ctx.i18n.t` and the FE `$t` body. */
export type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

/**
 * Authenticated fetch for one named service slot. Same signature as
 * `ctx.api` / `apiFetch`: full-path or service-relative paths in,
 * `Promise<Response>` out.
 */
export type ServiceApiFn = (path: string, init?: RequestInit) => Promise<Response>;

/** Named service-api slots: `'host'` = raw host API base; `'ai'`/`'job'`/… = `/ws/<code>`-bound. */
export type ServiceApiName = 'host' | 'self' | (string & {});

let _t: Readable<TranslateFn> | undefined;
let _openSheet: OpenSheetFn | undefined;
let _mfaStepUp: MfaStepUpFn | undefined;
const _serviceApis = new Map<string, ServiceApiFn>();

function unbound(slot: string): never {
	throw new Error(
		`@primebrick/ui: '${slot}' bridge is not bound — ` +
			`host must bind it at app boot (host-bindings.ts), remote pages via bindRemoteCtx(ctx)`,
	);
}

/**
 * Bind the translation store. Pass the FE `t` `Readable` directly (host) or
 * `readable(ctx.i18n.t)` (remote) — components then call `getT()` once and
 * use `$t(key)` exactly like today.
 */
export function bindI18n(t: Readable<TranslateFn>): void {
	_t = t;
}

/** The bound translation store — throws when unbound (no fake fallback). */
export function getT(): Readable<TranslateFn> {
	if (!_t) unbound('i18n');
	return _t!;
}

/** Bind the host sheet opener (`openSheet` bridge / `ctx.components.openSheet`). */
export function bindSheet(fn: OpenSheetFn): void {
	_openSheet = fn;
}

/** The bound sheet opener — throws when unbound. */
export function getOpenSheet(): OpenSheetFn {
	if (!_openSheet) unbound('openSheet');
	return _openSheet!;
}

/** Bind the host step-up MFA bridge (`ctx.components.mfaStepUp`). */
export function bindStepUp(fn: MfaStepUpFn): void {
	_mfaStepUp = fn;
}

/** The bound step-up MFA bridge — throws when unbound. */
export function getStepUp(): MfaStepUpFn {
	if (!_mfaStepUp) unbound('mfaStepUp');
	return _mfaStepUp!;
}

/**
 * Bind a named service-api slot. `'host'` = raw authenticated fetch
 * (BE-owned `/api/v1/…` paths); a service code (`'ai'`, `'job'`, …) =
 * fetch already bound to that service's `/ws/<code>` base.
 */
export function bindServiceApi(name: ServiceApiName, fn: ServiceApiFn): void {
	_serviceApis.set(name, fn);
}

/** The bound fetch for a named slot — throws when unbound. */
export function getServiceApi(name: ServiceApiName): ServiceApiFn {
	const fn = _serviceApis.get(name);
	if (!fn) unbound(`serviceApi:${name}`);
	return fn;
}

/**
 * Remote-realm binding — one call wires every slot the vendored copy needs
 * from the host-provided ctx. Call once at the top of `mountPage(el, ctx)`:
 *
 *   export function mountPage(el, ctx) { bindRemoteCtx(ctx, { service: 'job' }); … }
 *
 * `ctx.api` is already bound to the owning service's `/ws/<code>` base by
 * the host — it is registered under `'self'` and under `service` when
 * provided, so service-owning ui composables keep working inside remotes.
 */
export function bindRemoteCtx(ctx: ModulePageHost, opts?: { service?: string }): void {
	bindI18n(readable((key: string, params?: Record<string, unknown>) => ctx.i18n.t(key, params)));
	if (ctx.components?.openSheet) bindSheet(ctx.components.openSheet);
	if (ctx.components?.mfaStepUp) bindStepUp(ctx.components.mfaStepUp);
	const hostApi = ctx.components?.hostApi as ServiceApiFn | undefined;
	if (hostApi) bindServiceApi('host', hostApi);
	bindServiceApi('self', ctx.api);
	if (opts?.service) bindServiceApi(opts.service, ctx.api);
}
