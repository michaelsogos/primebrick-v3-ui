<script lang="ts">
	import { Dialog as DialogPrimitive } from '../../vendor/bits-ui.js';

	let { open = $bindable(false), ...restProps }: DialogPrimitive.RootProps = $props();
</script>

<DialogPrimitive.Root bind:open {...restProps} />
