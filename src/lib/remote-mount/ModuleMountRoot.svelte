<script lang="ts">
	/**
	 * ModuleMountRoot — root wrapper for remote-mounted module content.
	 *
	 * A remote `mountSheet`/`mountPage` creates a NEW svelte root inside the
	 * host DOM: component context does NOT cross the `mount()` boundary, so
	 * ambient providers the host tree established (bits-ui `Tooltip.Provider`,
	 * anything context-scoped) are absent inside remote content. This wrapper
	 * is the remote realm's own ambient-provider root — every mounted module
	 * goes through it via `mountModuleContent`.
	 */
	import type { Component } from "svelte";
	import { Provider as TooltipProvider } from "../components/tooltip/index.js";

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let { content, ctx }: { content: Component<any>; ctx: unknown } = $props();
</script>

<TooltipProvider>
	{@const Content = content}
	<Content {ctx} />
</TooltipProvider>
