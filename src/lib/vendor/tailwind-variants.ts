// Sanctioned vendor-plane surface for `tailwind-variants` — one lib, one
// file, one subpath. Remote module code imports this subpath (never the raw
// package) so host and remotes share ONE instance through the vendor bundle.
export * from 'tailwind-variants';
