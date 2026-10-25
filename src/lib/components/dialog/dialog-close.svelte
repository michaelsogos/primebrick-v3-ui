<script lang="ts">
	import { Dialog as DialogPrimitive } from '../../vendor/bits-ui.js';

	let {
		ref = $bindable(null),
		type = "button",
		...restProps
	}: DialogPrimitive.CloseProps = $props();
</script>

<DialogPrimitive.Close bind:ref data-slot="dialog-close" {type} {...restProps} />
