import { getContext } from 'svelte';

// must match the literal key in tabs-list.svelte
const TABS_LIST_CTX = 'primebrick-tabs-list';

export interface TabsListContext {
	/**
	 * Value of the trigger the sliding pill currently rests on.
	 * While the pill translates to a newly selected tab this still holds the
	 * *departing* value — the label color moves to the arriving tab only when
	 * the pill lands, never before.
	 */
	readonly settledValue: string | null;
}

export function getTabsListContext(): TabsListContext | undefined {
	return getContext(TABS_LIST_CTX);
}
