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
export { default as SheetPanelLayout } from './components/sheet/SheetPanelLayout.svelte';
export { default as SheetHeader } from './components/sheet/SheetHeader.svelte';

// Widget primitives — namespace exports mirror the FE `import * as X`
// shape (`<Accordion.Root>`/`<Command.Item>`/…).
export * as Accordion from './components/accordion/index.js';
export * as Command from './components/command/index.js';
export * as Dialog from './components/dialog/index.js';
export * as Popover from './components/popover/index.js';
export * as Tooltip from './components/tooltip/index.js';
export {
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
	DialogContent,
	DialogTrigger,
	DialogClose,
	DialogOverlay,
	DialogPortal,
} from './components/dialog/index.js';
export {
	TooltipContent,
	TooltipTrigger,
	TooltipProvider,
	PriorityTooltipContent,
	type TooltipPriority,
} from './components/tooltip/index.js';

export { Button, buttonVariants } from './components/button/index.js';
export type { ButtonProps, ButtonSize, ButtonTone, ButtonVariant } from './components/button/index.js';
export { Badge, badgeVariants } from './components/badge/index.js';
export type { BadgeVariant } from './components/badge/index.js';
export { Checkbox, checkboxBaseClass, checkboxVisualOnlyClass, checkboxInteractiveClass } from './components/checkbox/index.js';
export type { CheckboxTone } from './components/checkbox/index.js';
export { ComboSelect } from './components/combo-select/index.js';
export { Switch } from './components/switch/index.js';
export { Slider, type SliderTone } from './components/slider/index.js';
export { SliderField } from './components/slider-field/index.js';
export { SwitchField } from './components/switch-field/index.js';
export { SelectableFieldset, SelectableRow, SelectableToolbar } from './components/selectable-fieldset/index.js';
export { RefreshButton } from './components/refresh-button/index.js';
export { default as BorderedDialog } from './components/dialog-bordered.svelte';
export { default as DynamicIcon } from './components/dynamic-icon/DynamicIcon.svelte';
export { default as FormLabelWithPriorityHelp } from './components/forms/FormLabelWithPriorityHelp.svelte';
export type { FieldHelp } from './components/forms/field-help.js';

// CSS-chrome helpers — class-string constants shared by form controls.
export {
	inputControlHoverClasses,
	inputGhostChromeClasses,
	inputBorderlessChromeClasses,
	inputTrailingIconColorClasses,
	inputTrailingIconButtonClasses,
} from './components/input/input-chrome.js';
export { badgeClassesFromToken, tailwindSwatches, tailwindFamilies } from './colors/badge.js';
export type { TailwindColorToken, TailwindSwatch } from './colors/badge.js';
export * from './components/menu-row-chrome.js';

// AI domain leaf libs — dual-realm consumption mirror (shell chrome AND
// remote module chunks); the domain truth stays service-side. Also
// reachable as the narrow `@primebrick/ui/ai` subpath.
export * from './ai/index.js';
export * from './cache/etag-store.js';
export * from './remote-mount/index.js';

// AI-domain components + composables — shared by shell chrome (host
// panels) and the ai module's remote sheets (vendor plane → one instance).
export { default as ScoreGauge, gaugeColor } from './components/ai/ScoreGauge.svelte';
export { default as ModelIcon } from './components/ai/ModelIcon.svelte';
export { default as HuggingFaceIcon } from './components/ai/HuggingFaceIcon.svelte';
export { default as RankMeter } from './components/ai/RankMeter.svelte';
export { default as StorageBreakdownBar } from './components/ai/StorageBreakdownBar.svelte';
export { default as AiModelOption } from './components/ai/ai-model-option.svelte';
export { default as CerebellumRecommendationBadge } from './components/ai/cerebellum-recommendation-badge.svelte';
export { default as ModelCacheSection } from './components/ai/ModelCacheSection.svelte';
export { default as ModelCachePanel } from './components/ai/ModelCachePanel.svelte';
export { useAiModels } from './composables/useAiModels.svelte.js';
export { useAiCerebellum } from './composables/useAiCerebellum.svelte.js';
export { useModelCache, friendlyModelName } from './composables/useModelCache.svelte.js';
