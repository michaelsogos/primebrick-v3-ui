/**
 * remote-mount — the remote realm's mount root.
 *
 * `mountModuleContent` is the ONE way a remote chunk mounts its content:
 * the chunk's `mountPage`/`mountSheet` dispatches to its domain component,
 * this helper mounts it inside `ModuleMountRoot` — the wrapper that
 * establishes the ambient UI providers a fresh svelte root would otherwise
 * lack (context does not cross `mount()` boundaries).
 */
import { mount, type Component } from "svelte";
import type { ModuleHostBase } from "@primebrick/core";
import ModuleMountRoot from "./ModuleMountRoot.svelte";

export function mountModuleContent(
	el: HTMLElement,
	ctx: ModuleHostBase,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	content: Component<any>,
) {
	return mount(ModuleMountRoot, { target: el, props: { content, ctx } });
}

export { ModuleMountRoot };
