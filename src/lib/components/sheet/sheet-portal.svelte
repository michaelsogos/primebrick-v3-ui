<script lang="ts">
	import { Dialog as SheetPrimitive } from '../../vendor/bits-ui.js';

	let { ...restProps }: SheetPrimitive.PortalProps = $props();
</script>

<SheetPrimitive.Portal {...restProps} />
