import { type VariantProps, tv } from '../../vendor/tailwind-variants.js';

export const kbdVariants = tv({
	base: "inline-flex shrink-0 items-center justify-center rounded border border-border bg-muted/50 font-mono font-semibold leading-none text-muted-foreground",
	variants: {
		size: {
			key: "h-5 min-w-5 px-1 text-[11px]",
			modifier: "h-5 px-1.5 text-[10px]",
			icon: "size-5 [&>svg]:size-3.5",
			"key-lg": "h-6 min-w-6 px-1.5 text-base",
			"modifier-lg": "h-6 px-2 text-xs",
			"icon-lg": "size-6 [&>svg]:size-4",
		},
		tone: {
			default: "",
			/** Solid chip for dark surfaces (the standard bg-foreground tooltip) — same look as the default, full opacity. */
			inverted: "bg-muted",
		},
	},
	defaultVariants: {
		size: "key",
		tone: "default",
	},
});

export type KbdSize = VariantProps<typeof kbdVariants>["size"];
export type KbdTone = VariantProps<typeof kbdVariants>["tone"];
