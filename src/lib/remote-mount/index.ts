/**
 * remote-mount — the remote realm's mount root.
 *
 * `mountModuleContent` is the ONE way a remote chunk mounts its content:
 * the chunk's `mountPage`/`mountSheet` dispatches to its domain component,
 * this helper mounts it inside `ModuleMountRoot` — the wrapper that
 * establishes the ambient UI providers a fresh svelte root would otherwise
 * lack (context does not cross `mount()` boundaries).
 */
import { mount, unmount, type Component } from "svelte";
import type { ModuleHostBase } from "@primebrick/core";
import ModuleMountRoot from "./ModuleMountRoot.svelte";

export function mountModuleContent(
	el: HTMLElement,
	ctx: ModuleHostBase,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	content: Component<any>,
): () => Promise<void> {
	// Return a dispose closure, never the raw mount result: the record is
	// registered in THIS module's svelte `mounted_components` map, so only
	// THIS bundle's `unmount` can tear it down. Remote chunks resolve svelte
	// through the vendor import map while the host bundles its own copy —
	// handing the record out would hit `lifecycle_double_unmount` and leak
	// the mounted tree (the MountPageFn contract's "custom dispose" branch
	// exists exactly for this split-instance reality).
	const instance = mount(ModuleMountRoot, { target: el, props: { content, ctx } });
	return () => unmount(instance);
}

export { ModuleMountRoot };
