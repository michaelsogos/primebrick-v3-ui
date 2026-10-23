// Sanctioned vendor-plane surface for `@lucide/svelte` — one lib, one file,
// one subpath. Remote module code imports this subpath (never the raw
// package) so host and remotes share ONE icon registry/component instance
// through the vendor bundle.
export * from '@lucide/svelte';
