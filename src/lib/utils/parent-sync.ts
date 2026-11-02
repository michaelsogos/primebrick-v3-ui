/**
 * Parent-tab sync for module form pages (remote chunks AND host pages).
 *
 * Platform convention: entity form pages open as child tabs
 * (`EntityTablePage` `navStrategy="popup"` → `window.open`). After a
 * successful save the child broadcasts `'refresh'` on the family channel
 * (`primebrick_<entity>_sync`) and closes itself; the parent list page
 * listens in receiver mode (`EntityTablePage.syncChannel` /
 * `useSyncChannel`) and re-fetches its rows. Same-tab navigation remains
 * the non-child path.
 *
 * Env-neutral (no `$app/*`): remotes mount in the same origin so
 * `window.opener`/`BroadcastChannel` are native browser APIs.
 */

/** `true` when this page was opened as a child tab (`window.open`). */
export function isChildTab(): boolean {
	return typeof window !== 'undefined' && !!window.opener;
}

/**
 * Broadcast `'refresh'` on `channel` and close the tab when running as a
 * child — returns `true` when it closed (caller MUST NOT navigate).
 * Returns `false` in a normal tab so the caller can `goto`/assign the
 * list route instead.
 */
export function notifyParentAndClose(channel: string): boolean {
	if (!isChildTab()) return false;
	try {
		new BroadcastChannel(channel).postMessage('refresh');
	} catch {
		// Channel failure must never trap the user in a dead tab.
	}
	window.close();
	return true;
}
