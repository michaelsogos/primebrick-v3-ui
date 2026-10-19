# @primebrick/ui

Shared Svelte 5 component library for Primebrick v3 — components, composables,
primitives and utilities consumed by the core frontend app and remote module
pages.

Distributed via `svelte-package`: `src/lib` ships as `.svelte` sources +
`.d.ts` — consumers compile with their own Svelte 5 compiler (remote ESM module
pages bundle their own copy; rune state is bundle-local by design).

## Install

```bash
pnpm add @primebrick/ui
```

Requires `svelte ^5` (peer dependency).

## Usage

```ts
import { cn, type WithElementRef } from "@primebrick/ui";
```

## Contents (v3.0.0 — bootstrap)

| Export | Purpose |
|--------|---------|
| `cn` | `clsx` + `tailwind-merge` class combiner |
| `WithoutChild` / `WithoutChildren` / `WithoutChildrenOrChild` / `WithElementRef` | prop-helper types for component composition |

Components migrate here from `primebrick-fe-v3` as the shared-library extraction
lands (entity list system, ui primitives, composables).

## License

MIT — see [LICENSE](./LICENSE).
