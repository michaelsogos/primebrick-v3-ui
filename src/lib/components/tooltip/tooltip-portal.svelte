<script lang="ts">
	import { Portal as TooltipPrimitivePortal } from "../../vendor/bits-ui-tooltip.js";
	import type { PortalProps } from "../../vendor/bits-ui-tooltip.js";

	let { ...restProps }: PortalProps = $props();
</script>

<TooltipPrimitivePortal {...restProps} />
