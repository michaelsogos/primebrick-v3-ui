// Canonical shared contracts — re-exported so the FE (and remote module
// pages) get entity-meta/list/decimal types through this package.
export * from '@primebrick/core';

export * from './utils/index.js';
export * from './icons/composed-icons.js';
export * from './icons/semantic-icons.js';

export * from './bridges.js';

export { useSelection } from './composables/useSelection.svelte.js';

export { default as SparklineBars } from './components/SparklineBars.svelte';
export type { SparklineBucket, SparklineSeries } from './components/SparklineBars.svelte';

// Sheet primitive — the bits-ui Dialog-based surface the sheet engine and
// remote sheet consumers share (`import { Sheet } from '@primebrick/ui'` →
// `<Sheet.Root>`/`<Sheet.Content>`/…).
export * as Sheet from './components/sheet/index.js';
export { default as SheetPanelLayout } from './components/sheet/SheetPanelLayout.svelte';
export { default as SheetPanelFooter } from './components/sheet/SheetPanelFooter.svelte';
export { default as SheetHeader } from './components/sheet/SheetHeader.svelte';

// Widget primitives — namespace exports mirror the FE `import * as X`
// shape (`<Accordion.Root>`/`<Command.Item>`/…).
export * as Accordion from './components/accordion/index.js';
export * as Choicebox from './components/choicebox/index.js';
export * as Command from './components/command/index.js';
export * as Dialog from './components/dialog/index.js';
export * as InputGroup from './components/input-group/index.js';
export * as Popover from './components/popover/index.js';
export * as Tabs from './components/tabs/index.js';
export * as Tooltip from './components/tooltip/index.js';
export * as WheelPicker from './components/wheel-picker/index.js';
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
export { PropNavigator } from './components/prop-navigator/index.js';
export type { PropNavNode } from './components/prop-navigator/index.js';
export { usePropNavigation } from './composables/use-prop-navigation.svelte.js';
export { Kbd, kbdVariants } from './components/kbd/index.js';
export type { KbdSize } from './components/kbd/index.js';
export { KeyboardHints, type KeyboardHint } from './components/keyboard-hints/index.js';
export { Switch } from './components/switch/index.js';
export { Slider, type SliderTone } from './components/slider/index.js';
export { SliderField } from './components/slider-field/index.js';
export { SwitchField } from './components/switch-field/index.js';
export { SelectableFieldset, SelectableRow, SelectableToolbar } from './components/selectable-fieldset/index.js';
export { RefreshButton } from './components/refresh-button/index.js';
export {
	Toolbar,
	ToolbarButton,
	ToolbarLink,
	ToolbarGroup,
	ToolbarGroupItem,
	ToolbarDivider,
} from './components/toolbar/index.js';
export {
	ButtonGroup,
	ButtonGroupText,
	ButtonGroupSeparator,
	buttonGroupVariants,
	type ButtonGroupOrientation,
} from './components/button-group/index.js';
export { Separator } from './components/separator/index.js';
export { StatCard } from './components/stat-card/index.js';
export { NumberTicker } from './components/number-ticker/index.js';
export { DeleteDialog, EntityConfirmQuestion, DeletionFilterToggle } from './components/entity-list/index.js';
export { getEntitiesNsContext, setEntitiesNsContext } from './components/entity-list/index.js';
export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from './components/input-otp/index.js';
export { OtpInput } from './components/otp-input/index.js';
export { useOtpInput } from './composables/useOtpInput.svelte.js';
export { useConfigEntries } from './composables/useConfigEntries.svelte.js';
export { useMachineCapabilities } from './composables/useMachineCapabilities.svelte.js';
export type { MachineCapabilities } from './composables/useMachineCapabilities.svelte.js';
export { default as BorderedDialog } from './components/dialog-bordered.svelte';
export { default as DynamicIcon } from './components/dynamic-icon/DynamicIcon.svelte';
export { default as FormLabelWithPriorityHelp } from './components/forms/FormLabelWithPriorityHelp.svelte';
export type { FieldHelp } from './components/forms/field-help.js';
export { Label } from './components/label/index.js';
export {
	FormField,
	FormControl,
	FormLabel,
	FormDescription,
	FormFieldErrors,
	TranslatedFormFieldErrors,
	FormFieldset,
	FormLegend,
	FormElementField,
	FormButton,
	PrimeField,
} from './components/forms/index.js';
export type { PrimeFieldHelp, MetaTooltipHelp, HelpContext, ResolvedHelp } from './components/forms/index.js';
export { resolveFieldHelp } from './components/forms/index.js';
export { default as Input } from './components/input/input.svelte';
export { default as TextInput } from './components/input/text-input.svelte';
export { Textarea } from './components/textarea/index.js';
export { NumericInput } from './components/numeric-input/index.js';
export { DateWheelPicker } from './components/date-dropper/index.js';
export { SearchInput, SearchSyntaxHighlighter } from './components/search-input/index.js';
export {
	CronInput,
	CRON_FIELDS,
	acceptChar,
	distributePaste,
	emitExpression,
	validateFieldToken,
} from './components/cron-input/index.js';
export type { CronFieldMeta, CronFieldKey } from './components/cron-input/index.js';
export {
	parseScheduleSpec,
	nextScheduleRuns,
	describeScheduleSpec,
	type ScheduleSpec,
	type ParsedScheduleSpec,
	type ScheduleDescription,
} from './utils/parse-schedule-spec.js';
export type { SearchTrailingButton } from './components/search-input/index.js';
export * from './components/search-input/search-syntax.js';
export { useNumericInput } from './composables/useNumericInput.svelte.js';
export type { NumericKind, NumericUomSpec, NumericUomCtx } from './composables/useNumericInput.svelte.js';
export { CopyButton } from './components/copy-button/index.js';
export type { CopyButtonProps, CopyButtonPropsWithoutHTML } from './components/copy-button/index.js';
export { UseClipboard, copyText } from './composables/useClipboard.svelte.js';
export { JsonCodeBlock, JsonEditor } from './components/json-code-block/index.js';
export { default as JsonValueEditor } from './components/json-value-editor/json-value-editor.svelte';
export { default as PayloadMapEditor } from './components/payload-map-editor/payload-map-editor.svelte';
export { default as AiIcon } from './components/ai-icon/ai-icon.svelte';
export { ScheduleSpecInput } from './components/schedule-spec-input/index.js';
export { ScheduleSpecCell } from './components/schedule-spec-cell/index.js';
export { scheduleDescriptionText, scheduleRunLabel } from './utils/schedule-spec-i18n.js';

export { fieldSpecToZod } from './entity-form/field-spec-to-zod.js';

// CSS-chrome helpers — class-string constants shared by form controls.
export {
	inputControlHoverClasses,
	inputGhostChromeClasses,
	inputBorderlessChromeClasses,
	inputTrailingIconColorClasses,
	inputTrailingIconButtonClasses,
} from './components/input/input-chrome.js';
export { badgeClassesFromToken, colorCssFromToken, tailwindSwatches, tailwindFamilies } from './colors/badge.js';
export type { TailwindColorToken, TailwindSwatch } from './colors/badge.js';
export { cssToLuminance, contrastTextCss, hexLuminance, hexToRgb, rgbCssToHex, hslToHex, hslCssToHex, oklchCssToHex } from './colors/contrast.js';
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
export { default as QwenIcon } from './components/ai/QwenIcon.svelte';
export { default as MetaIcon } from './components/ai/MetaIcon.svelte';
export { default as MicrosoftIcon } from './components/ai/MicrosoftIcon.svelte';
export { default as NvidiaIcon } from './components/ai/NvidiaIcon.svelte';
export { default as IbmIcon } from './components/ai/IbmIcon.svelte';
export { default as GemmaIcon } from './components/ai/GemmaIcon.svelte';
export { default as DeepSeekIcon } from './components/ai/DeepSeekIcon.svelte';
export { default as OpenAIIcon } from './components/ai/OpenAIIcon.svelte';
export { default as RankMeter } from './components/ai/RankMeter.svelte';
export { default as StorageBreakdownBar } from './components/ai/StorageBreakdownBar.svelte';
export { default as AiModelOption } from './components/ai/ai-model-option.svelte';
export { default as CerebellumRecommendationBadge } from './components/ai/cerebellum-recommendation-badge.svelte';
export { default as ModelCacheSection } from './components/ai/ModelCacheSection.svelte';
export { default as ModelCachePanel } from './components/ai/ModelCachePanel.svelte';
export { useAiModels } from './composables/useAiModels.svelte.js';
export { useAiCerebellum } from './composables/useAiCerebellum.svelte.js';
export { useModelCache, friendlyModelName } from './composables/useModelCache.svelte.js';
