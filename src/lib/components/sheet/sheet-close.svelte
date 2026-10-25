<script lang="ts">
	import { Dialog as SheetPrimitive } from '../../vendor/bits-ui.js';

	let { ref = $bindable(null), ...restProps }: SheetPrimitive.CloseProps = $props();
</script>

<SheetPrimitive.Close bind:ref data-slot="sheet-close" {...restProps} />
