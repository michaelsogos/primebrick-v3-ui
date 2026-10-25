/**
 * Re-export Bits UI tooltip primitives without `import { Tooltip } from 'bits-ui'`.
 * Vite 8 SSR can evaluate that namespace as undefined in barrels, breaking `Tooltip.Root`.
 * Deep `dist/bits/tooltip/exports.js` path (filesystem-relative, sanctioned inside vendor/).
 */
export {
	Root,
	Trigger,
	Provider,
	Content,
	Portal,
} from '../../../node_modules/bits-ui/dist/bits/tooltip/exports.js';
export type { ContentProps } from '../../../node_modules/bits-ui/dist/bits/tooltip/exports.js';
export type { PortalProps } from '../../../node_modules/bits-ui/dist/bits/tooltip/exports.js';
