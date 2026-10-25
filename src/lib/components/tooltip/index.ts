import { Root, Trigger, Provider } from "../../vendor/bits-ui-tooltip.js";
import Content from "./tooltip-content.svelte";
import PriorityContent from "./priority-tooltip-content.svelte";
import type { TooltipPriority } from "@primebrick/core";





export {
	Root,
	Trigger,
	Content,
	PriorityContent,
	Provider,
	//
	Root as Tooltip,
	Content as TooltipContent,
	PriorityContent as PriorityTooltipContent,
	Trigger as TooltipTrigger,
	Provider as TooltipProvider,
};

export type { TooltipPriority };
