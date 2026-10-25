# @primebrick/ui

Shared Svelte 5 component library for Primebrick v3 — components,
composables, primitives and utilities consumed by the core frontend app
and remote module pages. Also owns the **vendor plane**: sanctioned
`./vendor/<lib>` subpaths (clsx, tailwind-merge, tailwind-variants,
lucide, bits-ui, transformers) that the host import map resolves to
prebuilt bundles — one library instance shared between host and remotes.

Distributed via `svelte-package`: `src/lib` ships as `.svelte` sources +
`.d.ts` — consumers compile with their own Svelte 5 compiler.

## Install

```bash
pnpm add @primebrick/ui
```

Requires `svelte ^5` (peer dependency).

## Documentation

- [AGENTS.md](./AGENTS.md) — agent entry point, repo conventions
- [docs/dev-guide/](./docs/dev-guide/) — component catalog + generated API
  reference
- `package.json` `exports` — the source of truth for every importable
  subpath (components, utils, `./vendor/<lib>`)

## License

MIT — see [LICENSE](./LICENSE).
