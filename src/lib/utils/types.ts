/**
 * Component-prop helper types shared by every ui component.
 * Mirror of the FE conventions (shadcn-svelte lineage).
 */

/** Props minus a `child` field — used by as-child composition patterns. */
export type WithoutChild<T> = T extends { child?: unknown } ? Omit<T, 'child'> : T;

/** Props minus `children`. */
export type WithoutChildren<T> = T extends { children?: unknown } ? Omit<T, 'children'> : T;

/** Props minus both `children` and `child`. */
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;

/** Props extended with a bindable element `ref`. */
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

/**
 * Recursively maps a type to its read-only equivalent.
 * - Arrays become ReadonlyArray (no push, splice, index assignment)
 * - Object properties become readonly
 * - Primitives are unchanged
 *
 * Type-only — erased at compile time. No runtime wrapper.
 * The underlying $state proxy is returned as-is, preserving Svelte 5 reactivity.
 */
export type DeepReadonly<T> = T extends (infer U)[]
	? ReadonlyArray<DeepReadonly<U>>
	: T extends object
		? { readonly [K in keyof T]: DeepReadonly<T[K]> }
		: T;
