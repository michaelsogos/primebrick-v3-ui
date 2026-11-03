/**
 * One node in the prop-navigation tree. `value` is ALWAYS the full path
 * (`$.customer.address`) — `label` is the segment rendered inside its
 * column. Nodes MAY be both navigable (`children.length > 0`) and
 * selectable (the caller's `isSelectable` predicate decides) — a
 * container CAN be a valid value (whole-object → `record` targets).
 */
export type PropNavNode = {
	/** Full path — the committed value. */
	value: string;
	/** Segment label rendered in the column row. */
	label: string;
	children?: PropNavNode[];
	_icon?: string;
	_icon_dashed?: boolean;
	_sub?: string;
	/** The schema this node carries — consumers feed it to their
	 *  compatibility predicate (`pathCompatible` in payload-map). Loose
	 *  record: the lib owns no schema type, callers pass their own shape. */
	_schema?: Record<string, unknown>;
};
