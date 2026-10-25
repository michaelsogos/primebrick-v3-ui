<script lang="ts">
	import { Dialog as DialogPrimitive } from '../../vendor/bits-ui.js';

	let {
		ref = $bindable(null),
		type = "button",
		...restProps
	}: DialogPrimitive.TriggerProps = $props();
</script>

<DialogPrimitive.Trigger bind:ref data-slot="dialog-trigger" {type} {...restProps} />
