# AI AGENT INSTRUCTIONS - @primebrick/ui

## ⚠️ CRITICAL: NEVER COMMIT AUTOMATICALLY

**AI agents MUST NEVER commit changes without explicit user instruction.**

- **WAIT for the user to explicitly tell you to commit** before running any `git commit` command
- This applies to ALL situations — no exceptions
- See [docs/gitflow.md](./docs/gitflow.md) for complete GitFlow rules including commit rules

## Repository overview

`@primebrick/ui` is the shared **Svelte 5 component library** for Primebrick v3 —
reusable components, composables, primitives and utilities consumed by:

- `primebrick-fe-v3` (the core frontend app)
- Remote module pages (ESM chunks that bundle their own copy of this library —
  Svelte rune state is bundle-local, so host and remote each own a copy)

Build is `svelte-package` — `src/lib` ships as `.svelte` sources + `.d.ts` in
`dist/`; consumers compile with their own Svelte compiler.

**Hard invariants:**

- **Svelte 5 runes only** — `$props`, `$state`, `$derived`, snippets. No legacy
  Svelte 4 idioms (`createEventDispatcher`, `$$Props`, stores-first patterns).
- **No app-coupled imports** — no `$app/*`, no `$lib` aliases pointing at the
  host app, no route navigation imports. Cross-cutting contracts come from
  `@primebrick/core`.
- **Host-context via props** — anything host-specific (i18n `t`, permissions,
  navigation) arrives via plain function/prop injection, never via app stores.

**Documentation language:** All `*.md` files use **English**.

## Commands

| Action | Command |
|--------|---------|
| Install | `pnpm install` |
| Build (svelte-package) | `pnpm run build` |
| Type check | `pnpm check` (`svelte-check`) |
| Test | `pnpm test` |
| Extract docs (sveld) | `pnpm extract-docs` |

## Conventions

- **snake_case everywhere** — contract-shaped props/fields stay snake_case.
- **Fixed dependency versions** — except `peerDependencies` (semver ranges are
  required semantics for libraries; `svelte: ^5.0.0` is intentional).
- **Components live under `src/lib/components/`**, utilities under
  `src/lib/utils/`, composables under `src/lib/composables/`.

## GitFlow

This repository follows GitFlow. AI agents MUST follow these rules.

**See [docs/gitflow.md](./docs/gitflow.md) for complete GitFlow rules.**

## Package Versioning — FIXED versions only (MANDATORY)

All registry package versions in `package.json` MUST be pinned to exact
versions. `peerDependencies` are the deliberate exception — libraries need
semver ranges there.

See [.devin/rules/package-versioning.md](./.devin/rules/package-versioning.md).

## Documentation (3 tiers — see `.devin/rules/docs-audience.md`)

Developer documentation lives in `docs/dev-guide/` as MDX files, synced to
`docs.primebrick.dev` under the dev section — never ingested into the end-user
AI KB.

- **Ordering**: `docs/dev-guide/_order.json` defines the sidebar page order
- **Conventions**: see `.devin/rules/docs-dev-guide.md`
- **Mermaid**: use `<Mermaid chart={...} />`, never fenced mermaid
- **Component extraction**: `pnpm extract-docs` →
  `docs/dev-guide/_extracted/components.json` (sveld)
