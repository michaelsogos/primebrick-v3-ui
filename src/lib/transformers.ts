// Sanctioned surface for @huggingface/transformers — vendored by the host
// behind `@primebrick/ui/transformers`. Remote module code imports this
// subpath (never the raw package — `resolveVendorSpecifier` rejects it) so
// the host and every remote chunk share ONE transformers runtime instance:
// one model-file cache view, one env config, one loaded-session registry.
export * from '@huggingface/transformers';
