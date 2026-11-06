/**
 * resolveFieldHelp — the ONE resolver deciding whether a field-label help
 * icon renders and with what content. Consumed by `PrimeField` (label
 * chrome); unit-testable without mounting Svelte.
 *
 * Contract:
 *
 * - `MetaColumn`-shaped help (`tooltip*` keys, i18n keys — translated by the
 *   caller) resolves ONLY when `tooltip` is present AND the surface flag
 *   allows it: `show_form_tooltip` in form contexts, `show_list_tooltip`
 *   in list contexts (both opt-out — absent means show).
 * - Pre-mapped `FieldHelp` (`text` already translated) resolves when at
 *   least one renderable member exists. An object with NO text, title,
 *   priority or labelKey must return `null` — a truthy empty object renders
 *   a ghost `?` icon whose tooltip never opens (observed on tooltip-less
 *   MetaColumns falling through `isMetaTooltipHelp`).
 */
import type { FieldHelp } from './field-help.js';
import type { TooltipPriority } from '../tooltip/index.js';

/** Raw column-meta help shape (MetaColumn-compatible). */
export interface MetaTooltipHelp {
	/** i18n key for tooltip content (translated by the caller). */
	tooltip?: string;
	/** Priority/severity from column meta. */
	tooltip_priority?: TooltipPriority;
	/** i18n key for tooltip title (translated by the caller). */
	tooltip_title?: string;
	/** Meta flag — tooltip hidden on form surfaces when `false`. */
	show_form_tooltip?: boolean;
	/** Meta flag — tooltip hidden on list surfaces when `false`. */
	show_list_tooltip?: boolean;
}

export type PrimeFieldHelp = FieldHelp | MetaTooltipHelp;

/** Which surface flag gates a meta tooltip — forms or lists. */
export type HelpContext = 'form' | 'list';

export interface ResolvedHelp {
	text?: string;
	priority?: TooltipPriority;
	title?: string;
	labelKey?: string;
}

function isMetaTooltipHelp(h: PrimeFieldHelp): h is MetaTooltipHelp {
	return 'tooltip' in h || 'tooltip_title' in h || 'tooltip_priority' in h;
}

export function resolveFieldHelp(
	help: PrimeFieldHelp | undefined,
	context: HelpContext,
	t: (key: string) => string,
): ResolvedHelp | null {
	if (!help) return null;
	if (isMetaTooltipHelp(help)) {
		const gate =
			context === 'list' ? help.show_list_tooltip : help.show_form_tooltip;
		if (!help.tooltip || gate === false) return null;
		return {
			text: t(help.tooltip),
			priority: help.tooltip_priority,
			title: help.tooltip_title ? t(help.tooltip_title) : undefined,
		};
	}
	const resolved: ResolvedHelp = {
		text: help.text,
		priority: help.priority,
		title: help.title,
		labelKey: help.labelKey,
	};
	return resolved.text ?? resolved.title ?? resolved.priority ?? resolved.labelKey
		? resolved
		: null;
}
