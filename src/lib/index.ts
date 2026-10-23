// Canonical shared contracts — re-exported so the FE (and remote module
// pages) get entity-meta/list/decimal types through this package.
export * from '@primebrick/core';

export * from './utils/index.js';

export * from './bridges.js';

export { useSelection } from './composables/useSelection.svelte.js';

export { default as SparklineBars } from './components/SparklineBars.svelte';
export type { SparklineBucket, SparklineSeries } from './components/SparklineBars.svelte';

// Sheet primitive — the bits-ui Dialog-based surface the sheet engine and
// remote sheet consumers share (`import { Sheet } from '@primebrick/ui'` →
// `<Sheet.Root>`/`<Sheet.Content>`/…).
export * as Sheet from './components/sheet/index.js';
