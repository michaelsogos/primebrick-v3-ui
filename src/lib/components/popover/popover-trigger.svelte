<script lang="ts">
	import { Popover as PopoverPrimitive } from '../../vendor/bits-ui.js';

	let { ref = $bindable(null), ...restProps }: PopoverPrimitive.TriggerProps = $props();
</script>

<PopoverPrimitive.Trigger bind:ref data-slot="popover-trigger" {...restProps} />
