// Sanctioned vendor-plane surface for `bits-ui` — one lib, one file, one
// subpath. Remote module code imports this subpath (never the raw package)
// so host and remotes share ONE instance through the vendor bundle.
// Kept as its own subpath by design: name collisions with lucide
// (Calendar/Command/Ellipsis) are the CONSUMER's to resolve via `as` aliases.
export * from 'bits-ui';
