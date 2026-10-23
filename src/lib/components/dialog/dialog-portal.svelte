<script lang="ts">
	import { Dialog as DialogPrimitive } from '../../vendor/bits-ui.js';

	let { ...restProps }: DialogPrimitive.PortalProps = $props();
</script>

<DialogPrimitive.Portal {...restProps} />
